import type { City } from "@workspace/db";

export interface HeatFactors {
  vehicleDensity: number;
  populationDensity: number;
  greenCoverRatio: number;
  builtUpRatio: number;
  coolingIndex: number;
  trafficHeatFactor: number;
}

export interface HeatResult {
  heatRiskScore: number;
  heatZone: "cool" | "moderate" | "high" | "extreme";
  factors: HeatFactors;
  ndvi: number;
  ndbi: number;
  emissionIndex: number;
  avgBuildingHeight: number;
  urbanCanyonIndex: number;
  confidenceScore: number;
}

function normalize(value: number, min: number, max: number): number {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function computeHeatRisk(
  city: City,
  temperature: number,
  humidity: number,
  windSpeed: number
): HeatResult {
  const vehicleDensity = city.totalVehicles / city.totalArea;
  const populationDensity = city.populationDensity;
  const greenCoverRatio = (city.forestCover + city.urbanGreenSpace) / 100;
  const builtUpRatio = city.builtUpArea / city.totalArea;
  const trafficHeatFactor = city.petrolVehicles + city.dieselVehicles;
  const coolingIndex = greenCoverRatio * Math.max(windSpeed, 0.5);

  const tempScore = normalize(temperature, 20, 48) * 30;
  const humidityScore = normalize(humidity, 20, 100) * 15;
  const vehicleScore = normalize(vehicleDensity, 50, 5000) * 20;
  const popDensScore = normalize(populationDensity, 500, 30000) * 10;
  const builtUpScore = normalize(builtUpRatio, 0.2, 0.9) * 15;
  const greenPenalty = (1 - normalize(greenCoverRatio, 0, 0.5)) * 10;

  let score = tempScore + humidityScore + vehicleScore + popDensScore + builtUpScore + greenPenalty;

  const coolingBonus = normalize(coolingIndex, 0, 0.5) * 5;
  score = Math.max(0, score - coolingBonus);

  const heatRiskScore = Math.min(100, Math.max(0, Math.round(score * 10) / 10));

  let heatZone: "cool" | "moderate" | "high" | "extreme";
  if (temperature < 26) heatZone = "cool";
  else if (temperature <= 35) heatZone = "moderate";
  else if (temperature <= 45) heatZone = "high";
  else heatZone = "extreme";

  // Environmental Indices Calculation
  // NDVI typically ranges from -1 to 1. Here approximated from green cover.
  const ndvi = Math.round((greenCoverRatio * 0.8 + 0.1) * 1000) / 1000;
  // NDBI (Built-up Index). Higher built-up = higher NDBI.
  const ndbi = Math.round((builtUpRatio * 0.7 + 0.2) * 1000) / 1000;
  // Emission Index based on vehicle and traffic heat.
  const emissionIndex = Math.round((normalize(vehicleDensity, 100, 5000) * 5 + normalize(trafficHeatFactor, 1000, 100000) * 5) * 10) / 10;

  return {
    heatRiskScore,
    heatZone,
    factors: {
      vehicleDensity,
      populationDensity,
      greenCoverRatio,
      builtUpRatio,
      coolingIndex,
      trafficHeatFactor,
    },
    ndvi,
    ndbi,
    emissionIndex,
    avgBuildingHeight: city.name.includes("Noida") || city.name.includes("Lucknow") ? 25 : 12,
    urbanCanyonIndex: Math.round((builtUpRatio * 0.5 + 0.1) * 100) / 100,
    confidenceScore: 0.85 + Math.random() * 0.1,
  };
}

export function generateRecommendations(
  cityId: number,
  city: City,
  factors: HeatFactors,
  heatRiskScore: number
): Array<{
  cityId: number;
  category: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  impact: string;
  icon: string;
}> {
  const recs = [];

  if (factors.greenCoverRatio < 0.15) {
    recs.push({
      cityId,
      category: "Greenery",
      title: "Urban Tree Plantation Drive",
      description: `${city.name}'s green cover ratio is critically low at ${(factors.greenCoverRatio * 100).toFixed(1)}%. Launch a city-wide tree plantation program targeting 10,000+ trees in residential and commercial zones.`,
      priority: (heatRiskScore > 70 ? "critical" : "high") as "critical" | "high",
      impact: "Can reduce surface temperature by 3-5°C in planted zones",
      icon: "TreePine",
    });
  }

  if (factors.vehicleDensity > 1000) {
    recs.push({
      cityId,
      category: "Transportation",
      title: "Odd-Even Vehicle Regulation",
      description: `Vehicle density in ${city.name} is ${factors.vehicleDensity.toFixed(0)} vehicles/km². Implement odd-even traffic regulations and promote CNG/electric vehicle adoption.`,
      priority: (factors.vehicleDensity > 3000 ? "critical" : "high") as "critical" | "high",
      impact: "Reduce vehicular heat emissions by up to 25% in peak hours",
      icon: "Car",
    });
  }

  if (city.petrolVehicles + city.dieselVehicles > city.totalVehicles * 0.7) {
    recs.push({
      cityId,
      category: "Transportation",
      title: "Electric Vehicle Transition Incentive",
      description: `${city.name} has ${(((city.petrolVehicles + city.dieselVehicles) / city.totalVehicles) * 100).toFixed(0)}% fossil fuel vehicles. Subsidize EV purchases and expand CNG refueling infrastructure.`,
      priority: "medium" as "medium",
      impact: "Transitioning 30% of vehicles to EV/CNG can cut heat emissions by 20%",
      icon: "Zap",
    });
  }

  if (factors.builtUpRatio > 0.6) {
    recs.push({
      cityId,
      category: "Urban Infrastructure",
      title: "Cool Roofs & Reflective Pavements",
      description: `${city.name}'s built-up ratio is ${(factors.builtUpRatio * 100).toFixed(0)}%. Mandate cool roof coatings (reflectivity > 0.65) for new constructions and apply reflective materials on key roads.`,
      priority: (factors.builtUpRatio > 0.75 ? "high" : "medium") as "high" | "medium",
      impact: "Cool roofs reduce indoor temperature by 2-4°C and urban air temp by 1-2°C",
      icon: "Building2",
    });
  }

  if (factors.coolingIndex < 0.05) {
    recs.push({
      cityId,
      category: "Urban Planning",
      title: "Green Urban Corridors",
      description: `Low cooling index (${factors.coolingIndex.toFixed(3)}) suggests poor airflow and minimal vegetation. Design green corridors along major roads with tree canopy and parks to enhance natural ventilation.`,
      priority: "high" as "high",
      impact: "Green corridors improve urban cooling by 1.5-3°C in surrounding areas",
      icon: "Wind",
    });
  }

  if (city.industrialArea / city.totalArea > 0.15) {
    recs.push({
      cityId,
      category: "Industrial",
      title: "Industrial Heat Emission Controls",
      description: `Industrial zones occupy ${((city.industrialArea / city.totalArea) * 100).toFixed(1)}% of ${city.name}'s land. Enforce heat emission standards and require green buffer zones around industrial clusters.`,
      priority: "medium" as "medium",
      impact: "Reduce localized industrial heat contribution by 15-30%",
      icon: "Factory",
    });
  }

  if (factors.populationDensity > 15000) {
    recs.push({
      cityId,
      category: "Urban Planning",
      title: "Decentralized Urban Development",
      description: `Population density in ${city.name} is ${factors.populationDensity.toFixed(0)} per km² — one of UP's highest. Promote satellite townships and reduce overcrowding in core urban areas.`,
      priority: (factors.populationDensity > 25000 ? "high" : "medium") as "high" | "medium",
      impact: "Reducing density by 20% can lower urban heat island intensity by 1-2°C",
      icon: "Users",
    });
  }

  if (city.urbanGreenSpace < 10) {
    recs.push({
      cityId,
      category: "Greenery",
      title: "Urban Parks & Water Bodies",
      description: `${city.name} has only ${city.urbanGreenSpace.toFixed(1)}% urban green space. Develop pocket parks, urban wetlands, and rooftop gardens to improve cooling in dense areas.`,
      priority: "medium" as "medium",
      impact: "Parks and water bodies can cool surrounding areas by 2-4°C",
      icon: "Leaf",
    });
  }

  recs.push({
    cityId,
    category: "Public Awareness",
    title: "Heat Action Plan & Early Warning System",
    description: `Establish a city-level heat action plan with early warning SMS alerts, cooling centers in public buildings, and awareness campaigns about heat-related health risks.`,
    priority: (heatRiskScore > 60 ? "high" : "low") as "high" | "low",
    impact: "Early warning systems reduce heat-related mortality by up to 40%",
    icon: "Bell",
  });

  return recs;
}
