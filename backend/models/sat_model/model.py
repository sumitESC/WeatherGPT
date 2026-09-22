import torch
import torch.nn as nn
import math

class PositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=5000):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer('pe', pe.unsqueeze(0))

    def forward(self, x):
        return x + self.pe[:, :x.size(1)]

class SpatiotemporalCrossAttentionModel(nn.Module):
    def __init__(self, 
                 n_weather_features, 
                 n_context_features, 
                 n_targets,
                 embed_dim=64,
                 transformer_heads=4,
                 encoder_layers=2,
                 cross_attn_layers=2,
                 transformer_ff_dim=256,
                 dropout=0.2,
                 seq_length=30,
                 forecast_horizon=16):
        super().__init__()

        self.seq_length = seq_length
        self.forecast_horizon = forecast_horizon
        self.n_targets = n_targets

        # Embeddings
        self.local_proj = nn.Linear(n_weather_features, embed_dim)
        self.context_proj = nn.Linear(n_context_features, embed_dim)
        
        self.pos_encoder = PositionalEncoding(embed_dim, max_len=seq_length)

        # Local Branch Self-Attention (batch_first=True)
        local_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim, nhead=transformer_heads,
            dim_feedforward=transformer_ff_dim, dropout=dropout, batch_first=True
        )
        self.local_encoder = nn.TransformerEncoder(local_layer, num_layers=encoder_layers)

        # Context Branch Self-Attention
        context_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim, nhead=transformer_heads,
            dim_feedforward=transformer_ff_dim, dropout=dropout, batch_first=True
        )
        self.context_encoder = nn.TransformerEncoder(context_layer, num_layers=encoder_layers)

        # Cross-Attention Modules
        # We manually use MultiheadAttention for cross-attention.
        self.cross_attn_layers = nn.ModuleList([
            nn.MultiheadAttention(embed_dim, transformer_heads, dropout=dropout, batch_first=True)
            for _ in range(cross_attn_layers)
        ])
        self.cross_ffns = nn.ModuleList([
            nn.Sequential(
                nn.Linear(embed_dim, transformer_ff_dim),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(transformer_ff_dim, embed_dim),
                nn.Dropout(dropout)
            ) for _ in range(cross_attn_layers)
        ])
        self.layer_norms_1 = nn.ModuleList([nn.LayerNorm(embed_dim) for _ in range(cross_attn_layers)])
        self.layer_norms_2 = nn.ModuleList([nn.LayerNorm(embed_dim) for _ in range(cross_attn_layers)])

        # Decoder to output sequence
        # Flatten time dimension to project to forecast horizon
        self.decoder = nn.Sequential(
            nn.Linear(seq_length * embed_dim, transformer_ff_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(transformer_ff_dim, forecast_horizon * n_targets)
        )

    def count_parameters(self):
        return sum(p.numel() for p in self.parameters() if p.requires_grad)

    def forward(self, local_seq, context_seq):
        """
        local_seq: (B, seq_length, n_weather_features)
        context_seq: (B, seq_length, n_context_features)
        """
        # Embed and add positional encoding
        l_emb = self.local_proj(local_seq)
        c_emb = self.context_proj(context_seq)
        
        l_emb = self.pos_encoder(l_emb)
        c_emb = self.pos_encoder(c_emb)

        # Self-Attention Encoders
        l_encoded = self.local_encoder(l_emb)
        c_encoded = self.context_encoder(c_emb)

        # Cross-Attention: Local (Query) attends to Context (Key, Value)
        # This models how the spatial context influences the local microclimate over time
        x = l_encoded
        for i in range(len(self.cross_attn_layers)):
            attn_out, _ = self.cross_attn_layers[i](query=x, key=c_encoded, value=c_encoded)
            x = self.layer_norms_1[i](x + attn_out)
            ffn_out = self.cross_ffns[i](x)
            x = self.layer_norms_2[i](x + ffn_out)

        # Flatten and Decode
        x_flat = x.reshape(x.size(0), -1) # (B, seq_length * embed_dim)
        out = self.decoder(x_flat) # (B, forecast_horizon * n_targets)
        out = out.view(x.size(0), self.forecast_horizon, self.n_targets)

        # In a real model, we would add skip connections from the last known state,
        # but for simplicity we rely entirely on the decoder output.
        # Adding skip from the last day's variables could help.
        
        return out, None

class WeatherForecastLoss(nn.Module):
    def __init__(self, loss_weights=None, target_names=None):
        super().__init__()
        self.mse = nn.MSELoss(reduction='none')
        self.loss_weights = loss_weights
        self.target_names = target_names
        
        self.weight_tensor = None

    def forward(self, preds, targets, mask):
        if self.weight_tensor is None and self.loss_weights is not None:
            weights = []
            for name in self.target_names:
                weights.append(self.loss_weights.get(name, 1.0))
            self.weight_tensor = torch.tensor(weights, device=preds.device, dtype=preds.dtype)
            
        loss = self.mse(preds, targets)
        if self.weight_tensor is not None:
            loss = loss * self.weight_tensor.view(1, 1, -1)
            
        loss = loss * mask
        return loss.sum() / (mask.sum() + 1e-8)
