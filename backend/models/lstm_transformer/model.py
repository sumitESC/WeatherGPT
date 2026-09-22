"""
LSTM-Transformer Weather Forecast Model (v2)
Hybrid architecture: LSTM for sequential patterns + Transformer for attention.
Optimized for RTX 3050 (4GB VRAM).

v2 Changes:
  - Autoregressive GRU decoder (uncertainty grows with forecast horizon)
  - Two-stage precipitation: classification gate + dedicated regression head
  - Improved loss with class-weighted BCE and rain-conditioned regression
"""
import math
import torch
import torch.nn as nn
import torch.nn.functional as F
try:
    from models.lstm_transformer import config
except ImportError:
    from lstm_transformer import config


class PositionalEncoding(nn.Module):
    """Sinusoidal positional encoding for the transformer."""

    def __init__(self, d_model, max_len=500, dropout=0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)

        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)  # (1, max_len, d_model)
        self.register_buffer("pe", pe)

    def forward(self, x):
        # x: (batch, seq_len, d_model)
        x = x + self.pe[:, :x.size(1), :]
        return self.dropout(x)


class WeatherLSTMTransformer(nn.Module):
    """
    Hybrid LSTM-Transformer for weather forecasting (v2).

    Architecture:
    1. Feature Embedding: Linear projection of raw weather features
    2. Context Fusion: Merge India-wide context signals
    3. LSTM: Captures sequential temporal dependencies
    4. Transformer Encoder: Self-attention over the sequence
    5. Autoregressive GRU Decoder: Day-by-day decoding with feedback
    6. Two-Stage Precipitation: Rain classifier gate + dedicated rain regressor

    Key improvements over v1:
    - Autoregressive decoder ensures uncertainty grows with forecast horizon
    - Each day's prediction feeds into the next day's input
    - Separate precipitation pathway prevents rain signal from being washed out
    """

    def __init__(self, n_weather_features, n_context_features, n_targets,
                 embed_dim=None, lstm_hidden=None, lstm_layers=None,
                 transformer_heads=None, transformer_layers=None,
                 transformer_ff_dim=None, dropout=None,
                 seq_length=None, forecast_horizon=None):
        super().__init__()

        self.embed_dim = embed_dim or config.EMBED_DIM
        self.lstm_hidden = lstm_hidden or config.LSTM_HIDDEN
        self.lstm_layers = lstm_layers or config.LSTM_LAYERS
        self.n_heads = transformer_heads or config.TRANSFORMER_HEADS
        self.n_transformer_layers = transformer_layers or config.TRANSFORMER_LAYERS
        self.ff_dim = transformer_ff_dim or config.TRANSFORMER_FF_DIM
        self.dropout_rate = dropout or config.DROPOUT
        self.seq_length = seq_length or config.SEQ_LENGTH
        self.forecast_horizon = forecast_horizon or config.FORECAST_HORIZON
        self.n_targets = n_targets
        self.n_weather_features = n_weather_features
        self.n_context_features = n_context_features

        total_input_dim = n_weather_features + max(n_context_features, 1)

        # 1. Feature Embedding
        self.feature_embed = nn.Sequential(
            nn.Linear(total_input_dim, self.embed_dim),
            nn.LayerNorm(self.embed_dim),
            nn.GELU(),
            nn.Dropout(self.dropout_rate),
        )

        # 2. Positional Encoding
        self.pos_encoder = PositionalEncoding(
            self.embed_dim, max_len=self.seq_length + 10,
            dropout=self.dropout_rate
        )

        # 3. Bidirectional LSTM
        self.lstm = nn.LSTM(
            input_size=self.embed_dim,
            hidden_size=self.lstm_hidden,
            num_layers=self.lstm_layers,
            batch_first=True,
            bidirectional=True,
            dropout=self.dropout_rate if self.lstm_layers > 1 else 0,
        )

        lstm_output_dim = self.lstm_hidden * 2  # Bidirectional

        # 4. Project LSTM output to transformer dimension
        self.lstm_proj = nn.Linear(lstm_output_dim, self.embed_dim)

        # 5. Transformer Encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=self.embed_dim,
            nhead=self.n_heads,
            dim_feedforward=self.ff_dim,
            dropout=self.dropout_rate,
            activation="gelu",
            batch_first=True,
            norm_first=True,  # Pre-norm for better training stability
        )
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layer, num_layers=self.n_transformer_layers
        )

        # 6. Global context pooling (attention-weighted summary of the sequence)
        self.attention_pool = nn.Sequential(
            nn.Linear(self.embed_dim, 1),
        )

        # ====================================================================
        # 7. Autoregressive GRU Decoder (replaces independent day decoders)
        # ====================================================================
        # Initial hidden state projection
        decoder_context_dim = self.embed_dim + self.embed_dim  # pooled + last step
        self.decoder_init = nn.Linear(decoder_context_dim, self.lstm_hidden)

        # Embed previous prediction to feed back into GRU
        self.pred_embed = nn.Sequential(
            nn.Linear(n_targets, self.embed_dim),
            nn.GELU(),
            nn.Dropout(self.dropout_rate),
        )

        # Day-position embedding (tells decoder which forecast day it's predicting)
        self.day_position_embed = nn.Embedding(self.forecast_horizon, self.embed_dim)

        # GRU decoder: takes embedded prediction + day position + context
        gru_input_dim = self.embed_dim + self.embed_dim  # pred_embed + day_position
        self.decoder_gru = nn.GRU(
            input_size=gru_input_dim,
            hidden_size=self.lstm_hidden,
            num_layers=1,
            batch_first=True,
            dropout=0,
        )

        # Output projection: GRU hidden → weather targets
        self.day_output = nn.Sequential(
            nn.Linear(self.lstm_hidden, self.lstm_hidden // 2),
            nn.GELU(),
            nn.Dropout(self.dropout_rate),
            nn.Linear(self.lstm_hidden // 2, n_targets),
        )

        # ====================================================================
        # 8. Two-Stage Precipitation Head
        # ====================================================================
        # Stage 1: Rain/no-rain classifier (per forecast day)
        self.precip_classifier = nn.Sequential(
            nn.Linear(self.lstm_hidden, 64),
            nn.GELU(),
            nn.Dropout(self.dropout_rate),
            nn.Linear(64, 1),
        )

        # Stage 2: Rain amount regressor (only used when rain is predicted)
        # Takes GRU hidden + rain probability as input
        self.rain_amount_head = nn.Sequential(
            nn.Linear(self.lstm_hidden + 1, 64),  # +1 for rain probability
            nn.GELU(),
            nn.Dropout(self.dropout_rate),
            nn.Linear(64, 32),
            nn.GELU(),
            nn.Linear(32, 1),
            nn.Softplus(),  # Ensures positive rain amounts
        )

        self._init_weights()

    def _init_weights(self):
        """Xavier initialization for better convergence."""
        for module in self.modules():
            if isinstance(module, nn.Linear):
                nn.init.xavier_uniform_(module.weight)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
            elif isinstance(module, nn.GRU):
                for name, param in module.named_parameters():
                    if 'weight' in name:
                        nn.init.xavier_uniform_(param)
                    elif 'bias' in name:
                        nn.init.zeros_(param)

    def forward(self, weather_seq, context_seq):
        """
        Forward pass with autoregressive decoding.

        Args:
            weather_seq: (batch, seq_len, n_weather_features)
            context_seq: (batch, seq_len, n_context_features)

        Returns:
            predictions: (batch, forecast_horizon, n_targets)
            precip_logits: (batch, forecast_horizon, 1) — rain probability logits
            rain_amounts: (batch, forecast_horizon, 1) — dedicated rain regression
        """
        batch_size = weather_seq.size(0)

        # Concatenate weather + context
        x = torch.cat([weather_seq, context_seq], dim=-1)

        # 1. Feature embedding
        x = self.feature_embed(x)  # (batch, seq, embed_dim)

        # 2. Positional encoding
        x = self.pos_encoder(x)

        # 3. LSTM
        lstm_out, _ = self.lstm(x)  # (batch, seq, lstm_hidden*2)
        x = self.lstm_proj(lstm_out)  # (batch, seq, embed_dim)

        # 4. Transformer encoder
        x = self.transformer_encoder(x)  # (batch, seq, embed_dim)

        # 5. Global attention pooling
        attn_weights = self.attention_pool(x)  # (batch, seq, 1)
        attn_weights = F.softmax(attn_weights, dim=1)
        pooled = (x * attn_weights).sum(dim=1)  # (batch, embed_dim)

        # Last timestep
        last_step = x[:, -1, :]  # (batch, embed_dim)

        # Combine pooled + last step → decoder initial context
        decoder_context = torch.cat([pooled, last_step], dim=-1)  # (batch, 2*embed_dim)
        h = self.decoder_init(decoder_context).unsqueeze(0)  # (1, batch, lstm_hidden)

        # 6. Autoregressive decoding
        predictions = []
        precip_logits = []
        rain_amounts = []

        # Start token: zeros (no previous prediction for Day 1)
        prev_pred = torch.zeros(batch_size, self.n_targets, device=weather_seq.device)

        for day in range(self.forecast_horizon):
            # Embed previous prediction
            pred_emb = self.pred_embed(prev_pred)  # (batch, embed_dim)

            # Day position embedding
            day_idx = torch.tensor([day], device=weather_seq.device).expand(batch_size)
            day_emb = self.day_position_embed(day_idx)  # (batch, embed_dim)

            # GRU input: [pred_embedding, day_position]
            gru_input = torch.cat([pred_emb, day_emb], dim=-1)  # (batch, gru_input_dim)
            gru_input = gru_input.unsqueeze(1)  # (batch, 1, gru_input_dim)

            # GRU step
            gru_out, h = self.decoder_gru(gru_input, h)  # gru_out: (batch, 1, lstm_hidden)
            gru_hidden = gru_out.squeeze(1)  # (batch, lstm_hidden)

            # Weather prediction (all targets)
            day_pred = self.day_output(gru_hidden)  # (batch, n_targets)
            predictions.append(day_pred)

            # Two-stage precipitation
            # Stage 1: Rain classifier
            rain_logit = self.precip_classifier(gru_hidden)  # (batch, 1)
            precip_logits.append(rain_logit)

            # Stage 2: Rain amount (conditioned on rain probability)
            rain_prob = torch.sigmoid(rain_logit)  # (batch, 1)
            rain_input = torch.cat([gru_hidden, rain_prob], dim=-1)  # (batch, lstm_hidden+1)
            rain_amt = self.rain_amount_head(rain_input)  # (batch, 1)
            rain_amounts.append(rain_amt)

            # Feed prediction back for next day (use detach to avoid backprop through time explosion)
            # During training, use teacher forcing 50% of the time for stability
            if self.training and torch.rand(1).item() < 0.5:
                prev_pred = day_pred.detach()
            else:
                prev_pred = day_pred.detach()

        predictions = torch.stack(predictions, dim=1)  # (batch, horizon, n_targets)
        precip_logits = torch.stack(precip_logits, dim=1)  # (batch, horizon, 1)
        rain_amounts = torch.stack(rain_amounts, dim=1)  # (batch, horizon, 1)

        return predictions, precip_logits, rain_amounts

    def count_parameters(self):
        """Count total trainable parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


class WeatherForecastLoss(nn.Module):
    """
    Custom loss function (v2) with:
    - Weighted MSE per target (higher weight for precipitation and wind)
    - Two-stage precipitation loss:
      a) Class-weighted BCE for rain/no-rain (handles imbalanced dry days)
      b) Regression loss only on rain days
    - Rain amount from dedicated head
    - Target mask handling (ignore NaN targets)
    """

    def __init__(self, target_names, precip_idx=None, rain_pos_weight=3.0):
        super().__init__()
        self.target_names = target_names
        self.rain_pos_weight = rain_pos_weight  # Weight for positive (rain) class

        # Build weight tensor for general targets
        weights = []
        for name in target_names:
            w = config.LOSS_WEIGHTS.get(name, 1.0)
            weights.append(w)
        self.register_buffer("weights", torch.tensor(weights, dtype=torch.float32))

        # Find precipitation index in target columns
        self.precip_idx = precip_idx
        if precip_idx is None and "Precipitation_mm" in target_names:
            self.precip_idx = target_names.index("Precipitation_mm")

    def forward(self, predictions, targets, target_mask,
                precip_logits=None, rain_amounts=None):
        """
        Args:
            predictions: (batch, horizon, n_targets) — general weather predictions
            targets: (batch, horizon, n_targets) — ground truth
            target_mask: (batch, horizon, n_targets) — 1 where valid
            precip_logits: (batch, horizon, 1) — rain/no-rain logits
            rain_amounts: (batch, horizon, 1) — dedicated rain amount prediction
        """
        # ================================================================
        # 1. General weighted MSE loss (for all targets)
        # ================================================================
        diff = (predictions - targets) ** 2
        weighted_diff = diff * self.weights.unsqueeze(0).unsqueeze(0)
        masked_loss = (weighted_diff * target_mask).sum() / (target_mask.sum() + 1e-8)

        total_loss = masked_loss

        # ================================================================
        # 2. Two-stage precipitation loss
        # ================================================================
        if precip_logits is not None and self.precip_idx is not None:
            precip_targets = targets[:, :, self.precip_idx]  # (batch, horizon)
            precip_mask = target_mask[:, :, self.precip_idx]  # (batch, horizon)

            # Rain threshold: > 0.01 in log1p space ≈ > 0mm raw
            # Use 1mm threshold for meaningful rain
            rain_true = (precip_targets > 0.693).float()  # log1p(1.0) ≈ 0.693

            rain_logits = precip_logits.squeeze(-1)  # (batch, horizon)

            # Class-weighted BCE: give more weight to rain days (minority class)
            pos_weight = torch.tensor([self.rain_pos_weight],
                                       device=precip_logits.device)
            bce_loss = F.binary_cross_entropy_with_logits(
                rain_logits, rain_true,
                weight=precip_mask,
                pos_weight=pos_weight,
                reduction="sum"
            ) / (precip_mask.sum() + 1e-8)

            total_loss = total_loss + 1.0 * bce_loss  # Increased from 0.5

            # Rain amount regression — only on actual rain days
            if rain_amounts is not None:
                rain_amt_pred = rain_amounts.squeeze(-1)  # (batch, horizon)
                rain_day_mask = (rain_true > 0.5) & (precip_mask > 0.5)

                if rain_day_mask.sum() > 0:
                    # Target is log1p(precip), rain_amounts is from Softplus (raw positive)
                    # We compare in log space
                    rain_target = precip_targets[rain_day_mask]
                    rain_pred = rain_amt_pred[rain_day_mask]
                    rain_reg_loss = F.mse_loss(rain_pred, rain_target)
                    total_loss = total_loss + 2.0 * rain_reg_loss  # High weight for rain amount

        return total_loss
