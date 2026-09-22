import { db, citiesTable, weatherDataTable, heatPredictionsTable, recommendationsTable } from "@workspace/db";

const UP_CITIES = [
  {
    name: "Lucknow",
    latitude: 26.8467,
    longitude: 80.9462,
    population: 3457959,
    populationDensity: 1815,
    totalArea: 2528,
    builtUpArea: 851,
    industrialArea: 180,
    residentialArea: 500,
    roadArea: 95,
    openLand: 420,
    waterBodiesArea: 55,
    forestCover: 8.2,
    urbanGreenSpace: 12.5,
    treeDensity: 45,
    ndvi: 0.28,
    totalVehicles: 2850000,
    petrolVehicles: 1600000,
    dieselVehicles: 820000,
    electricVehicles: 95000,
    cngVehicles: 335000,
  },
  {
    name: "Kanpur",
    latitude: 26.4499,
    longitude: 80.3319,
    population: 2920496,
    populationDensity: 2956,
    totalArea: 1647,
    builtUpArea: 718,
    industrialArea: 310,
    residentialArea: 280,
    roadArea: 72,
    openLand: 182,
    waterBodiesArea: 35,
    forestCover: 5.4,
    urbanGreenSpace: 7.2,
    treeDensity: 28,
    ndvi: 0.19,
    totalVehicles: 2650000,
    petrolVehicles: 1480000,
    dieselVehicles: 910000,
    electricVehicles: 55000,
    cngVehicles: 205000,
  },
  {
    name: "Varanasi",
    latitude: 25.3176,
    longitude: 82.9739,
    population: 1432280,
    populationDensity: 2395,
    totalArea: 1535,
    builtUpArea: 502,
    industrialArea: 95,
    residentialArea: 280,
    roadArea: 60,
    openLand: 388,
    waterBodiesArea: 65,
    forestCover: 9.1,
    urbanGreenSpace: 11.8,
    treeDensity: 52,
    ndvi: 0.31,
    totalVehicles: 1380000,
    petrolVehicles: 750000,
    dieselVehicles: 430000,
    electricVehicles: 42000,
    cngVehicles: 158000,
  },
  {
    name: "Prayagraj",
    latitude: 25.4358,
    longitude: 81.8463,
    population: 1536211,
    populationDensity: 1760,
    totalArea: 2063,
    builtUpArea: 640,
    industrialArea: 140,
    residentialArea: 320,
    roadArea: 78,
    openLand: 520,
    waterBodiesArea: 80,
    forestCover: 10.3,
    urbanGreenSpace: 13.1,
    treeDensity: 58,
    ndvi: 0.33,
    totalVehicles: 1520000,
    petrolVehicles: 830000,
    dieselVehicles: 490000,
    electricVehicles: 48000,
    cngVehicles: 152000,
  },
  {
    name: "Agra",
    latitude: 27.1767,
    longitude: 78.0081,
    population: 1760285,
    populationDensity: 2320,
    totalArea: 1571,
    builtUpArea: 590,
    industrialArea: 175,
    residentialArea: 265,
    roadArea: 65,
    openLand: 278,
    waterBodiesArea: 40,
    forestCover: 6.2,
    urbanGreenSpace: 9.4,
    treeDensity: 38,
    ndvi: 0.22,
    totalVehicles: 1680000,
    petrolVehicles: 940000,
    dieselVehicles: 520000,
    electricVehicles: 62000,
    cngVehicles: 158000,
  },
  {
    name: "Ghaziabad",
    latitude: 28.6692,
    longitude: 77.4538,
    population: 2375820,
    populationDensity: 8652,
    totalArea: 1179,
    builtUpArea: 780,
    industrialArea: 210,
    residentialArea: 380,
    roadArea: 95,
    openLand: 95,
    waterBodiesArea: 15,
    forestCover: 3.8,
    urbanGreenSpace: 5.6,
    treeDensity: 18,
    ndvi: 0.14,
    totalVehicles: 2980000,
    petrolVehicles: 1680000,
    dieselVehicles: 870000,
    electricVehicles: 195000,
    cngVehicles: 235000,
  },
  {
    name: "Noida",
    latitude: 28.5355,
    longitude: 77.3910,
    population: 642381,
    populationDensity: 4260,
    totalArea: 2037,
    builtUpArea: 870,
    industrialArea: 380,
    residentialArea: 320,
    roadArea: 120,
    openLand: 240,
    waterBodiesArea: 18,
    forestCover: 7.5,
    urbanGreenSpace: 14.2,
    treeDensity: 62,
    ndvi: 0.35,
    totalVehicles: 1920000,
    petrolVehicles: 1050000,
    dieselVehicles: 560000,
    electricVehicles: 185000,
    cngVehicles: 125000,
  },
  {
    name: "Meerut", latitude: 28.9845, longitude: 77.7064, population: 1305429, populationDensity: 3200, totalArea: 408, builtUpArea: 250, industrialArea: 60, residentialArea: 150, roadArea: 35, openLand: 80, waterBodiesArea: 12, forestCover: 4.5, urbanGreenSpace: 8.2, treeDensity: 25, ndvi: 0.18, totalVehicles: 850000, petrolVehicles: 480000, dieselVehicles: 280000, electricVehicles: 30000, cngVehicles: 60000,
  },
  {
    name: "Bareilly", latitude: 28.3670, longitude: 79.4304, population: 904797, populationDensity: 2100, totalArea: 235, builtUpArea: 140, industrialArea: 40, residentialArea: 80, roadArea: 20, openLand: 60, waterBodiesArea: 8, forestCover: 5.1, urbanGreenSpace: 7.5, treeDensity: 22, ndvi: 0.20, totalVehicles: 550000, petrolVehicles: 320000, dieselVehicles: 180000, electricVehicles: 15000, cngVehicles: 35000,
  },
  {
    name: "Aligarh", latitude: 27.8974, longitude: 78.0880, population: 874408, populationDensity: 2400, totalArea: 345, builtUpArea: 180, industrialArea: 50, residentialArea: 100, roadArea: 25, openLand: 95, waterBodiesArea: 10, forestCover: 4.8, urbanGreenSpace: 6.9, treeDensity: 20, ndvi: 0.17, totalVehicles: 520000, petrolVehicles: 310000, dieselVehicles: 160000, electricVehicles: 12000, cngVehicles: 38000,
  },
  {
    name: "Moradabad", latitude: 28.8386, longitude: 78.7733, population: 887871, populationDensity: 2600, totalArea: 349, builtUpArea: 200, industrialArea: 45, residentialArea: 120, roadArea: 22, openLand: 85, waterBodiesArea: 15, forestCover: 3.5, urbanGreenSpace: 5.5, treeDensity: 15, ndvi: 0.15, totalVehicles: 490000, petrolVehicles: 280000, dieselVehicles: 170000, electricVehicles: 10000, cngVehicles: 30000,
  },
  {
    name: "Jhansi", latitude: 25.4484, longitude: 78.5685, population: 505693, populationDensity: 1500, totalArea: 315, builtUpArea: 120, industrialArea: 30, residentialArea: 70, roadArea: 18, openLand: 130, waterBodiesArea: 25, forestCover: 8.5, urbanGreenSpace: 10.2, treeDensity: 35, ndvi: 0.25, totalVehicles: 350000, petrolVehicles: 210000, dieselVehicles: 110000, electricVehicles: 8000, cngVehicles: 22000,
  },
  {
    name: "Gorakhpur", latitude: 26.7606, longitude: 83.3732, population: 673446, populationDensity: 1800, totalArea: 350, builtUpArea: 160, industrialArea: 25, residentialArea: 110, roadArea: 20, openLand: 120, waterBodiesArea: 40, forestCover: 6.5, urbanGreenSpace: 8.5, treeDensity: 28, ndvi: 0.22, totalVehicles: 420000, petrolVehicles: 250000, dieselVehicles: 140000, electricVehicles: 9000, cngVehicles: 21000,
  },
  {
    name: "Ayodhya", latitude: 26.7922, longitude: 82.1998, population: 350000, populationDensity: 1200, totalArea: 250, builtUpArea: 90, industrialArea: 10, residentialArea: 60, roadArea: 15, openLand: 100, waterBodiesArea: 35, forestCover: 9.0, urbanGreenSpace: 12.0, treeDensity: 40, ndvi: 0.28, totalVehicles: 200000, petrolVehicles: 120000, dieselVehicles: 60000, electricVehicles: 15000, cngVehicles: 5000,
  },
  {
    name: "Mathura", latitude: 27.4924, longitude: 77.6737, population: 456706, populationDensity: 1900, totalArea: 280, builtUpArea: 130, industrialArea: 35, residentialArea: 75, roadArea: 18, openLand: 110, waterBodiesArea: 20, forestCover: 5.5, urbanGreenSpace: 7.2, treeDensity: 22, ndvi: 0.19, totalVehicles: 310000, petrolVehicles: 190000, dieselVehicles: 100000, electricVehicles: 5000, cngVehicles: 15000,
  },
  {
    name: "Saharanpur", latitude: 29.9640, longitude: 77.5460, population: 705478, populationDensity: 2200, totalArea: 320, builtUpArea: 150, industrialArea: 40, residentialArea: 90, roadArea: 22, openLand: 120, waterBodiesArea: 12, forestCover: 6.8, urbanGreenSpace: 8.4, treeDensity: 26, ndvi: 0.21, totalVehicles: 410000, petrolVehicles: 240000, dieselVehicles: 130000, electricVehicles: 8000, cngVehicles: 32000,
  },
  {
    name: "Muzaffarnagar", latitude: 29.4727, longitude: 77.7085, population: 495000, populationDensity: 1900, totalArea: 250, builtUpArea: 110, industrialArea: 30, residentialArea: 65, roadArea: 15, openLand: 90, waterBodiesArea: 8, forestCover: 4.2, urbanGreenSpace: 6.0, treeDensity: 18, ndvi: 0.16, totalVehicles: 280000, petrolVehicles: 170000, dieselVehicles: 90000, electricVehicles: 5000, cngVehicles: 15000,
  },
  {
    name: "Firozabad", latitude: 27.1590, longitude: 78.3957, population: 604214, populationDensity: 2500, totalArea: 240, builtUpArea: 130, industrialArea: 45, residentialArea: 70, roadArea: 18, openLand: 75, waterBodiesArea: 6, forestCover: 3.8, urbanGreenSpace: 5.2, treeDensity: 15, ndvi: 0.14, totalVehicles: 320000, petrolVehicles: 190000, dieselVehicles: 110000, electricVehicles: 4000, cngVehicles: 16000,
  },
  {
    name: "Rampur", latitude: 28.8154, longitude: 79.0253, population: 325248, populationDensity: 1600, totalArea: 200, builtUpArea: 85, industrialArea: 20, residentialArea: 55, roadArea: 12, openLand: 80, waterBodiesArea: 10, forestCover: 5.0, urbanGreenSpace: 7.0, treeDensity: 20, ndvi: 0.18, totalVehicles: 180000, petrolVehicles: 110000, dieselVehicles: 60000, electricVehicles: 3000, cngVehicles: 7000,
  },
  {
    name: "Bijnor", latitude: 29.3724, longitude: 78.1358, population: 115000, populationDensity: 1300, totalArea: 120, builtUpArea: 40, industrialArea: 10, residentialArea: 25, roadArea: 8, openLand: 55, waterBodiesArea: 8, forestCover: 7.5, urbanGreenSpace: 9.0, treeDensity: 30, ndvi: 0.24, totalVehicles: 80000, petrolVehicles: 50000, dieselVehicles: 25000, electricVehicles: 2000, cngVehicles: 3000,
  },
  {
    name: "Etawah", latitude: 26.7658, longitude: 79.0150, population: 256838, populationDensity: 1400, totalArea: 180, builtUpArea: 75, industrialArea: 15, residentialArea: 50, roadArea: 12, openLand: 70, waterBodiesArea: 15, forestCover: 6.2, urbanGreenSpace: 8.5, treeDensity: 26, ndvi: 0.22, totalVehicles: 140000, petrolVehicles: 85000, dieselVehicles: 45000, electricVehicles: 3000, cngVehicles: 7000,
  },
  {
    name: "Rae Bareli", latitude: 26.2306, longitude: 81.2404, population: 191316, populationDensity: 1200, totalArea: 150, builtUpArea: 60, industrialArea: 15, residentialArea: 35, roadArea: 10, openLand: 65, waterBodiesArea: 8, forestCover: 5.8, urbanGreenSpace: 7.8, treeDensity: 24, ndvi: 0.20, totalVehicles: 110000, petrolVehicles: 65000, dieselVehicles: 35000, electricVehicles: 2000, cngVehicles: 8000,
  },
  {
    name: "Sitapur", latitude: 27.5684, longitude: 80.6789, population: 177234, populationDensity: 1100, totalArea: 160, builtUpArea: 55, industrialArea: 10, residentialArea: 35, roadArea: 10, openLand: 75, waterBodiesArea: 12, forestCover: 6.5, urbanGreenSpace: 8.0, treeDensity: 25, ndvi: 0.21, totalVehicles: 95000, petrolVehicles: 55000, dieselVehicles: 30000, electricVehicles: 2000, cngVehicles: 8000,
  },
  {
    name: "Hardoi", latitude: 27.3986, longitude: 80.1260, population: 197046, populationDensity: 1300, totalArea: 170, builtUpArea: 65, industrialArea: 12, residentialArea: 40, roadArea: 11, openLand: 70, waterBodiesArea: 10, forestCover: 5.5, urbanGreenSpace: 7.5, treeDensity: 22, ndvi: 0.19, totalVehicles: 105000, petrolVehicles: 60000, dieselVehicles: 35000, electricVehicles: 2000, cngVehicles: 8000,
  },
  {
    name: "Azamgarh", latitude: 26.0460, longitude: 83.1810, population: 933110, populationDensity: 1217, totalArea: 174, builtUpArea: 69, industrialArea: 17, residentialArea: 52, roadArea: 8, openLand: 34, waterBodiesArea: 8, forestCover: 4.9, urbanGreenSpace: 4.4, treeDensity: 38, ndvi: 0.21, totalVehicles: 466555, petrolVehicles: 279933, dieselVehicles: 139966, electricVehicles: 18662, cngVehicles: 27993,
  },
  {
    name: "Badaun", latitude: 28.0339, longitude: 79.1272, population: 907747, populationDensity: 2998, totalArea: 195, builtUpArea: 78, industrialArea: 19, residentialArea: 58, roadArea: 9, openLand: 39, waterBodiesArea: 9, forestCover: 8.3, urbanGreenSpace: 8.8, treeDensity: 32, ndvi: 0.2, totalVehicles: 453873, petrolVehicles: 272324, dieselVehicles: 136162, electricVehicles: 18154, cngVehicles: 27232,
  },
  {
    name: "Bahraich", latitude: 27.5744, longitude: 81.5976, population: 355497, populationDensity: 2646, totalArea: 196, builtUpArea: 78, industrialArea: 19, residentialArea: 58, roadArea: 9, openLand: 39, waterBodiesArea: 9, forestCover: 4.8, urbanGreenSpace: 9.2, treeDensity: 32, ndvi: 0.15, totalVehicles: 177748, petrolVehicles: 106649, dieselVehicles: 53324, electricVehicles: 7109, cngVehicles: 10664,
  },
  {
    name: "Ballia", latitude: 25.7590, longitude: 84.1480, population: 944003, populationDensity: 1273, totalArea: 227, builtUpArea: 90, industrialArea: 22, residentialArea: 68, roadArea: 11, openLand: 45, waterBodiesArea: 11, forestCover: 7.6, urbanGreenSpace: 6.3, treeDensity: 19, ndvi: 0.3, totalVehicles: 472001, petrolVehicles: 283200, dieselVehicles: 141600, electricVehicles: 18880, cngVehicles: 28320,
  },
  {
    name: "Banda", latitude: 25.4753, longitude: 80.3347, population: 569561, populationDensity: 2608, totalArea: 212, builtUpArea: 84, industrialArea: 21, residentialArea: 63, roadArea: 10, openLand: 42, waterBodiesArea: 10, forestCover: 4.8, urbanGreenSpace: 9.9, treeDensity: 21, ndvi: 0.11, totalVehicles: 284780, petrolVehicles: 170868, dieselVehicles: 85434, electricVehicles: 11391, cngVehicles: 17086,
  },
  {
    name: "Barabanki", latitude: 26.9038, longitude: 81.1963, population: 595107, populationDensity: 2832, totalArea: 133, builtUpArea: 53, industrialArea: 13, residentialArea: 39, roadArea: 6, openLand: 26, waterBodiesArea: 6, forestCover: 6.9, urbanGreenSpace: 4.8, treeDensity: 40, ndvi: 0.18, totalVehicles: 297553, petrolVehicles: 178532, dieselVehicles: 89266, electricVehicles: 11902, cngVehicles: 17853,
  },
  {
    name: "Basti", latitude: 26.7997, longitude: 82.7483, population: 243399, populationDensity: 1890, totalArea: 305, builtUpArea: 122, industrialArea: 30, residentialArea: 91, roadArea: 15, openLand: 61, waterBodiesArea: 15, forestCover: 3.5, urbanGreenSpace: 11.0, treeDensity: 34, ndvi: 0.12, totalVehicles: 121699, petrolVehicles: 73019, dieselVehicles: 36509, electricVehicles: 4867, cngVehicles: 7301,
  },
  {
    name: "Bhadohi", latitude: 25.3929, longitude: 82.5709, population: 698679, populationDensity: 1728, totalArea: 293, builtUpArea: 117, industrialArea: 29, residentialArea: 87, roadArea: 14, openLand: 58, waterBodiesArea: 14, forestCover: 4.3, urbanGreenSpace: 6.8, treeDensity: 18, ndvi: 0.16, totalVehicles: 349339, petrolVehicles: 209603, dieselVehicles: 104801, electricVehicles: 13973, cngVehicles: 20960,
  },
  {
    name: "Bulandshahr", latitude: 28.4069, longitude: 77.8498, population: 824473, populationDensity: 2939, totalArea: 280, builtUpArea: 112, industrialArea: 28, residentialArea: 84, roadArea: 14, openLand: 56, waterBodiesArea: 14, forestCover: 9.3, urbanGreenSpace: 7.7, treeDensity: 23, ndvi: 0.1, totalVehicles: 412236, petrolVehicles: 247341, dieselVehicles: 123670, electricVehicles: 16489, cngVehicles: 24734,
  },
  {
    name: "Chandauli", latitude: 25.2631, longitude: 83.2721, population: 336376, populationDensity: 1493, totalArea: 259, builtUpArea: 103, industrialArea: 25, residentialArea: 77, roadArea: 12, openLand: 51, waterBodiesArea: 12, forestCover: 8.4, urbanGreenSpace: 5.9, treeDensity: 31, ndvi: 0.16, totalVehicles: 168188, petrolVehicles: 100912, dieselVehicles: 50456, electricVehicles: 6727, cngVehicles: 10091,
  },
  {
    name: "Chitrakoot", latitude: 25.1764, longitude: 80.8647, population: 184250, populationDensity: 1716, totalArea: 372, builtUpArea: 148, industrialArea: 37, residentialArea: 111, roadArea: 18, openLand: 74, waterBodiesArea: 18, forestCover: 9.5, urbanGreenSpace: 8.1, treeDensity: 30, ndvi: 0.24, totalVehicles: 92125, petrolVehicles: 55275, dieselVehicles: 27637, electricVehicles: 3685, cngVehicles: 5527,
  },
  {
    name: "Deoria", latitude: 26.5020, longitude: 83.7791, population: 324870, populationDensity: 2898, totalArea: 319, builtUpArea: 127, industrialArea: 31, residentialArea: 95, roadArea: 15, openLand: 63, waterBodiesArea: 15, forestCover: 6.3, urbanGreenSpace: 9.3, treeDensity: 31, ndvi: 0.23, totalVehicles: 162435, petrolVehicles: 97461, dieselVehicles: 48730, electricVehicles: 6497, cngVehicles: 9746,
  },
  {
    name: "Etah", latitude: 27.5604, longitude: 78.6653, population: 253491, populationDensity: 1664, totalArea: 163, builtUpArea: 65, industrialArea: 16, residentialArea: 48, roadArea: 8, openLand: 32, waterBodiesArea: 8, forestCover: 5.0, urbanGreenSpace: 10.6, treeDensity: 31, ndvi: 0.12, totalVehicles: 126745, petrolVehicles: 76047, dieselVehicles: 38023, electricVehicles: 5069, cngVehicles: 7604,
  },
  {
    name: "Farrukhabad", latitude: 27.3826, longitude: 79.5843, population: 671278, populationDensity: 1567, totalArea: 125, builtUpArea: 50, industrialArea: 12, residentialArea: 37, roadArea: 6, openLand: 25, waterBodiesArea: 6, forestCover: 3.6, urbanGreenSpace: 6.4, treeDensity: 16, ndvi: 0.13, totalVehicles: 335639, petrolVehicles: 201383, dieselVehicles: 100691, electricVehicles: 13425, cngVehicles: 20138,
  },
  {
    name: "Fatehpur", latitude: 25.9281, longitude: 80.8130, population: 544172, populationDensity: 1146, totalArea: 281, builtUpArea: 112, industrialArea: 28, residentialArea: 84, roadArea: 14, openLand: 56, waterBodiesArea: 14, forestCover: 7.1, urbanGreenSpace: 5.8, treeDensity: 37, ndvi: 0.29, totalVehicles: 272086, petrolVehicles: 163251, dieselVehicles: 81625, electricVehicles: 10883, cngVehicles: 16325,
  },
  {
    name: "Ghazipur", latitude: 25.5818, longitude: 83.5786, population: 782239, populationDensity: 1697, totalArea: 235, builtUpArea: 94, industrialArea: 23, residentialArea: 70, roadArea: 11, openLand: 47, waterBodiesArea: 11, forestCover: 6.6, urbanGreenSpace: 11.5, treeDensity: 32, ndvi: 0.1, totalVehicles: 391119, petrolVehicles: 234671, dieselVehicles: 117335, electricVehicles: 15644, cngVehicles: 23467,
  },
  {
    name: "Gonda", latitude: 27.1332, longitude: 81.9619, population: 878669, populationDensity: 1839, totalArea: 264, builtUpArea: 105, industrialArea: 26, residentialArea: 79, roadArea: 13, openLand: 52, waterBodiesArea: 13, forestCover: 5.5, urbanGreenSpace: 5.6, treeDensity: 26, ndvi: 0.13, totalVehicles: 439334, petrolVehicles: 263600, dieselVehicles: 131800, electricVehicles: 17573, cngVehicles: 26360,
  },
  {
    name: "Hamirpur", latitude: 25.9525, longitude: 80.1517, population: 560161, populationDensity: 2762, totalArea: 343, builtUpArea: 137, industrialArea: 34, residentialArea: 102, roadArea: 17, openLand: 68, waterBodiesArea: 17, forestCover: 3.6, urbanGreenSpace: 11.7, treeDensity: 18, ndvi: 0.21, totalVehicles: 280080, petrolVehicles: 168048, dieselVehicles: 84024, electricVehicles: 11203, cngVehicles: 16804,
  },
  {
    name: "Hapur", latitude: 28.7306, longitude: 77.7758, population: 872341, populationDensity: 1458, totalArea: 252, builtUpArea: 100, industrialArea: 25, residentialArea: 75, roadArea: 12, openLand: 50, waterBodiesArea: 12, forestCover: 5.9, urbanGreenSpace: 7.0, treeDensity: 39, ndvi: 0.23, totalVehicles: 436170, petrolVehicles: 261702, dieselVehicles: 130851, electricVehicles: 17446, cngVehicles: 26170,
  },
  {
    name: "Hathras", latitude: 27.5971, longitude: 78.0514, population: 182068, populationDensity: 2101, totalArea: 206, builtUpArea: 82, industrialArea: 20, residentialArea: 61, roadArea: 10, openLand: 41, waterBodiesArea: 10, forestCover: 3.6, urbanGreenSpace: 6.3, treeDensity: 31, ndvi: 0.27, totalVehicles: 91034, petrolVehicles: 54620, dieselVehicles: 27310, electricVehicles: 3641, cngVehicles: 5462,
  },
  {
    name: "Jalaun", latitude: 25.9922, longitude: 79.4533, population: 475847, populationDensity: 1258, totalArea: 300, builtUpArea: 120, industrialArea: 30, residentialArea: 90, roadArea: 15, openLand: 60, waterBodiesArea: 15, forestCover: 6.4, urbanGreenSpace: 11.5, treeDensity: 34, ndvi: 0.29, totalVehicles: 237923, petrolVehicles: 142754, dieselVehicles: 71377, electricVehicles: 9516, cngVehicles: 14275,
  },
  {
    name: "Jaunpur", latitude: 25.7464, longitude: 82.6837, population: 893719, populationDensity: 1945, totalArea: 322, builtUpArea: 128, industrialArea: 32, residentialArea: 96, roadArea: 16, openLand: 64, waterBodiesArea: 16, forestCover: 7.6, urbanGreenSpace: 5.9, treeDensity: 36, ndvi: 0.2, totalVehicles: 446859, petrolVehicles: 268115, dieselVehicles: 134057, electricVehicles: 17874, cngVehicles: 26811,
  },
  {
    name: "Kannauj", latitude: 27.0552, longitude: 79.9182, population: 279086, populationDensity: 2116, totalArea: 160, builtUpArea: 64, industrialArea: 16, residentialArea: 48, roadArea: 8, openLand: 32, waterBodiesArea: 8, forestCover: 3.7, urbanGreenSpace: 4.2, treeDensity: 25, ndvi: 0.11, totalVehicles: 139543, petrolVehicles: 83725, dieselVehicles: 41862, electricVehicles: 5581, cngVehicles: 8372,
  },
  {
    name: "Kanpur Dehat", latitude: 26.3575, longitude: 79.8078, population: 203537, populationDensity: 1682, totalArea: 344, builtUpArea: 137, industrialArea: 34, residentialArea: 103, roadArea: 17, openLand: 68, waterBodiesArea: 17, forestCover: 9.2, urbanGreenSpace: 4.7, treeDensity: 38, ndvi: 0.19, totalVehicles: 101768, petrolVehicles: 61061, dieselVehicles: 30530, electricVehicles: 4070, cngVehicles: 6106,
  },
  {
    name: "Kasganj", latitude: 27.8080, longitude: 78.6472, population: 283303, populationDensity: 1441, totalArea: 201, builtUpArea: 80, industrialArea: 20, residentialArea: 60, roadArea: 10, openLand: 40, waterBodiesArea: 10, forestCover: 6.1, urbanGreenSpace: 8.7, treeDensity: 40, ndvi: 0.1, totalVehicles: 141651, petrolVehicles: 84990, dieselVehicles: 42495, electricVehicles: 5666, cngVehicles: 8499,
  },
  {
    name: "Kaushambi", latitude: 25.5348, longitude: 81.3813, population: 883788, populationDensity: 2618, totalArea: 148, builtUpArea: 59, industrialArea: 14, residentialArea: 44, roadArea: 7, openLand: 29, waterBodiesArea: 7, forestCover: 7.8, urbanGreenSpace: 5.0, treeDensity: 30, ndvi: 0.24, totalVehicles: 441894, petrolVehicles: 265136, dieselVehicles: 132568, electricVehicles: 17675, cngVehicles: 26513,
  },
  {
    name: "Kheri", latitude: 27.9463, longitude: 80.7788, population: 502323, populationDensity: 1863, totalArea: 306, builtUpArea: 122, industrialArea: 30, residentialArea: 91, roadArea: 15, openLand: 61, waterBodiesArea: 15, forestCover: 8.1, urbanGreenSpace: 10.5, treeDensity: 36, ndvi: 0.1, totalVehicles: 251161, petrolVehicles: 150696, dieselVehicles: 75348, electricVehicles: 10046, cngVehicles: 15069,
  },
  {
    name: "Kushinagar", latitude: 26.7408, longitude: 83.8887, population: 129129, populationDensity: 2136, totalArea: 245, builtUpArea: 98, industrialArea: 24, residentialArea: 73, roadArea: 12, openLand: 49, waterBodiesArea: 12, forestCover: 6.6, urbanGreenSpace: 10.2, treeDensity: 26, ndvi: 0.25, totalVehicles: 64564, petrolVehicles: 38738, dieselVehicles: 19369, electricVehicles: 2582, cngVehicles: 3873,
  },
  {
    name: "Lalitpur", latitude: 24.6908, longitude: 78.4116, population: 286368, populationDensity: 2729, totalArea: 319, builtUpArea: 127, industrialArea: 31, residentialArea: 95, roadArea: 15, openLand: 63, waterBodiesArea: 15, forestCover: 9.7, urbanGreenSpace: 6.7, treeDensity: 26, ndvi: 0.17, totalVehicles: 143184, petrolVehicles: 85910, dieselVehicles: 42955, electricVehicles: 5727, cngVehicles: 8591,
  },
  {
    name: "Maharajganj", latitude: 27.1442, longitude: 83.5627, population: 487366, populationDensity: 2095, totalArea: 210, builtUpArea: 84, industrialArea: 21, residentialArea: 63, roadArea: 10, openLand: 42, waterBodiesArea: 10, forestCover: 3.8, urbanGreenSpace: 10.5, treeDensity: 18, ndvi: 0.3, totalVehicles: 243683, petrolVehicles: 146209, dieselVehicles: 73104, electricVehicles: 9747, cngVehicles: 14620,
  },
  {
    name: "Mahoba", latitude: 25.2922, longitude: 79.8719, population: 785967, populationDensity: 2924, totalArea: 223, builtUpArea: 89, industrialArea: 22, residentialArea: 66, roadArea: 11, openLand: 44, waterBodiesArea: 11, forestCover: 9.2, urbanGreenSpace: 5.1, treeDensity: 19, ndvi: 0.28, totalVehicles: 392983, petrolVehicles: 235790, dieselVehicles: 117895, electricVehicles: 15719, cngVehicles: 23579,
  },
  {
    name: "Mainpuri", latitude: 27.2281, longitude: 79.0264, population: 258671, populationDensity: 1797, totalArea: 308, builtUpArea: 123, industrialArea: 30, residentialArea: 92, roadArea: 15, openLand: 61, waterBodiesArea: 15, forestCover: 7.3, urbanGreenSpace: 7.0, treeDensity: 38, ndvi: 0.29, totalVehicles: 129335, petrolVehicles: 77601, dieselVehicles: 38800, electricVehicles: 5173, cngVehicles: 7760,
  },
  {
    name: "Mau", latitude: 25.9417, longitude: 83.5611, population: 296252, populationDensity: 2186, totalArea: 104, builtUpArea: 41, industrialArea: 10, residentialArea: 31, roadArea: 5, openLand: 20, waterBodiesArea: 5, forestCover: 6.0, urbanGreenSpace: 8.3, treeDensity: 20, ndvi: 0.24, totalVehicles: 148126, petrolVehicles: 88875, dieselVehicles: 44437, electricVehicles: 5925, cngVehicles: 8887,
  },
  {
    name: "Mirzapur", latitude: 25.1460, longitude: 82.5690, population: 357649, populationDensity: 1157, totalArea: 288, builtUpArea: 115, industrialArea: 28, residentialArea: 86, roadArea: 14, openLand: 57, waterBodiesArea: 14, forestCover: 8.1, urbanGreenSpace: 8.0, treeDensity: 18, ndvi: 0.28, totalVehicles: 178824, petrolVehicles: 107294, dieselVehicles: 53647, electricVehicles: 7152, cngVehicles: 10729,
  },
  {
    name: "Orai", latitude: 25.9922, longitude: 79.4533, population: 144638, populationDensity: 2039, totalArea: 130, builtUpArea: 52, industrialArea: 13, residentialArea: 39, roadArea: 6, openLand: 26, waterBodiesArea: 6, forestCover: 8.7, urbanGreenSpace: 8.2, treeDensity: 24, ndvi: 0.21, totalVehicles: 72319, petrolVehicles: 43391, dieselVehicles: 21695, electricVehicles: 2892, cngVehicles: 4339,
  },
  {
    name: "Pilibhit", latitude: 28.6310, longitude: 79.8044, population: 987357, populationDensity: 2078, totalArea: 209, builtUpArea: 83, industrialArea: 20, residentialArea: 62, roadArea: 10, openLand: 41, waterBodiesArea: 10, forestCover: 4.6, urbanGreenSpace: 9.7, treeDensity: 36, ndvi: 0.2, totalVehicles: 493678, petrolVehicles: 296207, dieselVehicles: 148103, electricVehicles: 19747, cngVehicles: 29620,
  },
  {
    name: "Pratapgarh", latitude: 25.9003, longitude: 81.9972, population: 435535, populationDensity: 2882, totalArea: 188, builtUpArea: 75, industrialArea: 18, residentialArea: 56, roadArea: 9, openLand: 37, waterBodiesArea: 9, forestCover: 4.2, urbanGreenSpace: 7.5, treeDensity: 30, ndvi: 0.15, totalVehicles: 217767, petrolVehicles: 130660, dieselVehicles: 65330, electricVehicles: 8710, cngVehicles: 13066,
  },
  {
    name: "Sant Kabir Nagar", latitude: 26.7725, longitude: 83.0722, population: 665689, populationDensity: 1676, totalArea: 281, builtUpArea: 112, industrialArea: 28, residentialArea: 84, roadArea: 14, openLand: 56, waterBodiesArea: 14, forestCover: 5.3, urbanGreenSpace: 5.1, treeDensity: 23, ndvi: 0.13, totalVehicles: 332844, petrolVehicles: 199706, dieselVehicles: 99853, electricVehicles: 13313, cngVehicles: 19970,
  },
  {
    name: "Shahjahanpur", latitude: 27.8804, longitude: 79.9126, population: 837545, populationDensity: 2341, totalArea: 376, builtUpArea: 150, industrialArea: 37, residentialArea: 112, roadArea: 18, openLand: 75, waterBodiesArea: 18, forestCover: 3.2, urbanGreenSpace: 5.9, treeDensity: 27, ndvi: 0.27, totalVehicles: 418772, petrolVehicles: 251263, dieselVehicles: 125631, electricVehicles: 16750, cngVehicles: 25126,
  },
  {
    name: "Shamli", latitude: 29.4497, longitude: 77.3117, population: 725847, populationDensity: 1837, totalArea: 276, builtUpArea: 110, industrialArea: 27, residentialArea: 82, roadArea: 13, openLand: 55, waterBodiesArea: 13, forestCover: 4.9, urbanGreenSpace: 11.5, treeDensity: 18, ndvi: 0.18, totalVehicles: 362923, petrolVehicles: 217754, dieselVehicles: 108877, electricVehicles: 14516, cngVehicles: 21775,
  },
  {
    name: "Shravasti", latitude: 27.5085, longitude: 82.0456, population: 298002, populationDensity: 1613, totalArea: 111, builtUpArea: 44, industrialArea: 11, residentialArea: 33, roadArea: 5, openLand: 22, waterBodiesArea: 5, forestCover: 4.9, urbanGreenSpace: 8.5, treeDensity: 15, ndvi: 0.14, totalVehicles: 149001, petrolVehicles: 89400, dieselVehicles: 44700, electricVehicles: 5960, cngVehicles: 8940,
  },
  {
    name: "Siddharthnagar", latitude: 27.2975, longitude: 82.8122, population: 419612, populationDensity: 1542, totalArea: 226, builtUpArea: 90, industrialArea: 22, residentialArea: 67, roadArea: 11, openLand: 45, waterBodiesArea: 11, forestCover: 5.0, urbanGreenSpace: 4.7, treeDensity: 38, ndvi: 0.3, totalVehicles: 209806, petrolVehicles: 125883, dieselVehicles: 62941, electricVehicles: 8392, cngVehicles: 12588,
  },
  {
    name: "Sonbhadra", latitude: 24.6853, longitude: 83.0673, population: 516994, populationDensity: 1581, totalArea: 286, builtUpArea: 114, industrialArea: 28, residentialArea: 85, roadArea: 14, openLand: 57, waterBodiesArea: 14, forestCover: 7.7, urbanGreenSpace: 11.8, treeDensity: 40, ndvi: 0.15, totalVehicles: 258497, petrolVehicles: 155098, dieselVehicles: 77549, electricVehicles: 10339, cngVehicles: 15509,
  },
  {
    name: "Sultanpur", latitude: 26.2648, longitude: 82.0728, population: 328334, populationDensity: 2443, totalArea: 198, builtUpArea: 79, industrialArea: 19, residentialArea: 59, roadArea: 9, openLand: 39, waterBodiesArea: 9, forestCover: 6.1, urbanGreenSpace: 7.0, treeDensity: 23, ndvi: 0.26, totalVehicles: 164167, petrolVehicles: 98500, dieselVehicles: 49250, electricVehicles: 6566, cngVehicles: 9850,
  },
  {
    name: "Unnao", latitude: 26.5447, longitude: 80.4878, population: 603242, populationDensity: 1387, totalArea: 183, builtUpArea: 73, industrialArea: 18, residentialArea: 54, roadArea: 9, openLand: 36, waterBodiesArea: 9, forestCover: 7.9, urbanGreenSpace: 9.4, treeDensity: 25, ndvi: 0.13, totalVehicles: 301621, petrolVehicles: 180972, dieselVehicles: 90486, electricVehicles: 12064, cngVehicles: 18097,
  },
  {
    name: "Gautam Buddha Nagar", latitude: 28.5355, longitude: 77.3910, population: 911055, populationDensity: 2664, totalArea: 234, builtUpArea: 93, industrialArea: 23, residentialArea: 70, roadArea: 11, openLand: 46, waterBodiesArea: 11, forestCover: 6.8, urbanGreenSpace: 5.7, treeDensity: 26, ndvi: 0.17, totalVehicles: 455527, petrolVehicles: 273316, dieselVehicles: 136658, electricVehicles: 18221, cngVehicles: 27331,
  },
  {
    name: "Amroha", latitude: 28.9044, longitude: 78.4678, population: 693347, populationDensity: 2336, totalArea: 270, builtUpArea: 108, industrialArea: 27, residentialArea: 81, roadArea: 13, openLand: 54, waterBodiesArea: 13, forestCover: 7.7, urbanGreenSpace: 5.9, treeDensity: 33, ndvi: 0.21, totalVehicles: 346673, petrolVehicles: 208004, dieselVehicles: 104002, electricVehicles: 13866, cngVehicles: 20800,
  },
  {
    name: "Baghpat", latitude: 28.9442, longitude: 77.2246, population: 321923, populationDensity: 1344, totalArea: 373, builtUpArea: 149, industrialArea: 37, residentialArea: 111, roadArea: 18, openLand: 74, waterBodiesArea: 18, forestCover: 3.5, urbanGreenSpace: 11.1, treeDensity: 32, ndvi: 0.27, totalVehicles: 160961, petrolVehicles: 96576, dieselVehicles: 48288, electricVehicles: 6438, cngVehicles: 9657,
  },
  {
    name: "Balrampur", latitude: 27.4287, longitude: 82.1793, population: 797880, populationDensity: 2353, totalArea: 332, builtUpArea: 132, industrialArea: 33, residentialArea: 99, roadArea: 16, openLand: 66, waterBodiesArea: 16, forestCover: 4.2, urbanGreenSpace: 9.6, treeDensity: 18, ndvi: 0.3, totalVehicles: 398940, petrolVehicles: 239364, dieselVehicles: 119682, electricVehicles: 15957, cngVehicles: 23936,
  },
  {
    name: "Amethi", latitude: 26.1558, longitude: 81.8159, population: 632665, populationDensity: 1317, totalArea: 262, builtUpArea: 104, industrialArea: 26, residentialArea: 78, roadArea: 13, openLand: 52, waterBodiesArea: 13, forestCover: 9.8, urbanGreenSpace: 6.7, treeDensity: 39, ndvi: 0.24, totalVehicles: 316332, petrolVehicles: 189799, dieselVehicles: 94899, electricVehicles: 12653, cngVehicles: 18979,
  },
  {
    name: "Mau Nath Bhanjan", latitude: 25.9417, longitude: 83.5611, population: 370366, populationDensity: 2022, totalArea: 130, builtUpArea: 52, industrialArea: 13, residentialArea: 39, roadArea: 6, openLand: 26, waterBodiesArea: 6, forestCover: 6.7, urbanGreenSpace: 9.7, treeDensity: 17, ndvi: 0.2, totalVehicles: 185183, petrolVehicles: 111109, dieselVehicles: 55554, electricVehicles: 7407, cngVehicles: 11110,
  },
];

const WEATHER_BASE: Record<string, { temp: number; humidity: number; wind: number }> = {
  Lucknow:    { temp: 32.8, humidity: 68, wind: 4.2 },
  Kanpur:     { temp: 34.5, humidity: 72, wind: 3.8 },
  Varanasi:   { temp: 33.1, humidity: 70, wind: 3.5 },
  Prayagraj:  { temp: 35.2, humidity: 65, wind: 4.0 },
  Agra:       { temp: 36.4, humidity: 58, wind: 5.1 },
  Ghaziabad:  { temp: 35.8, humidity: 74, wind: 3.2 },
  Noida:      { temp: 34.9, humidity: 71, wind: 3.6 },
  Meerut:     { temp: 33.5, humidity: 62, wind: 3.2 },
  Bareilly:   { temp: 34.1, humidity: 64, wind: 3.8 },
  Aligarh:    { temp: 35.5, humidity: 60, wind: 4.1 },
  Moradabad:  { temp: 33.8, humidity: 66, wind: 3.4 },
  Jhansi:     { temp: 38.2, humidity: 55, wind: 5.2 },
  Gorakhpur:  { temp: 34.0, humidity: 75, wind: 3.9 },
  Ayodhya:    { temp: 34.2, humidity: 69, wind: 3.7 },
  Mathura:    { temp: 37.1, humidity: 56, wind: 4.8 },
  Saharanpur: { temp: 33.0, humidity: 63, wind: 3.5 },
  Muzaffarnagar: { temp: 33.2, humidity: 65, wind: 3.3 },
  Firozabad:  { temp: 36.8, humidity: 57, wind: 5.0 },
  Rampur:     { temp: 34.5, humidity: 67, wind: 3.6 },
  Bijnor:     { temp: 33.8, humidity: 66, wind: 3.5 },
  Etawah:     { temp: 36.5, humidity: 59, wind: 4.6 },
  "Rae Bareli": { temp: 34.8, humidity: 65, wind: 4.0 },
  Sitapur:    { temp: 34.0, humidity: 70, wind: 3.8 },
  Hardoi:     { temp: 34.5, humidity: 68, wind: 4.1 },
  "Azamgarh": { temp: 37.2, humidity: 72, wind: 3.8 },
  "Badaun": { temp: 37.2, humidity: 66, wind: 3.5 },
  "Bahraich": { temp: 35.6, humidity: 55, wind: 3.6 },
  "Ballia": { temp: 34.8, humidity: 75, wind: 3.0 },
  "Banda": { temp: 36.5, humidity: 57, wind: 4.4 },
  "Barabanki": { temp: 37.4, humidity: 62, wind: 3.4 },
  "Basti": { temp: 37.1, humidity: 70, wind: 4.9 },
  "Bhadohi": { temp: 34.4, humidity: 64, wind: 4.7 },
  "Bulandshahr": { temp: 33.6, humidity: 58, wind: 4.9 },
  "Chandauli": { temp: 35.8, humidity: 59, wind: 5.0 },
  "Chitrakoot": { temp: 35.3, humidity: 68, wind: 4.8 },
  "Deoria": { temp: 38.0, humidity: 65, wind: 4.5 },
  "Etah": { temp: 37.5, humidity: 74, wind: 4.0 },
  "Farrukhabad": { temp: 37.3, humidity: 59, wind: 3.7 },
  "Fatehpur": { temp: 37.8, humidity: 66, wind: 3.8 },
  "Ghazipur": { temp: 34.2, humidity: 73, wind: 4.3 },
  "Gonda": { temp: 34.8, humidity: 64, wind: 4.6 },
  "Hamirpur": { temp: 36.6, humidity: 67, wind: 3.2 },
  "Hapur": { temp: 33.9, humidity: 59, wind: 4.8 },
  "Hathras": { temp: 34.4, humidity: 62, wind: 3.7 },
  "Jalaun": { temp: 33.3, humidity: 69, wind: 3.9 },
  "Jaunpur": { temp: 36.1, humidity: 62, wind: 4.0 },
  "Kannauj": { temp: 33.7, humidity: 57, wind: 3.3 },
  "Kanpur Dehat": { temp: 35.7, humidity: 74, wind: 3.9 },
  "Kasganj": { temp: 37.6, humidity: 67, wind: 4.0 },
  "Kaushambi": { temp: 33.4, humidity: 61, wind: 3.3 },
  "Kheri": { temp: 37.2, humidity: 68, wind: 4.1 },
  "Kushinagar": { temp: 36.1, humidity: 63, wind: 3.7 },
  "Lalitpur": { temp: 37.4, humidity: 61, wind: 4.5 },
  "Maharajganj": { temp: 33.3, humidity: 70, wind: 4.7 },
  "Mahoba": { temp: 37.6, humidity: 74, wind: 3.4 },
  "Mainpuri": { temp: 36.5, humidity: 56, wind: 4.5 },
  "Mau": { temp: 35.5, humidity: 75, wind: 3.5 },
  "Mirzapur": { temp: 37.6, humidity: 64, wind: 4.9 },
  "Orai": { temp: 36.3, humidity: 58, wind: 4.6 },
  "Pilibhit": { temp: 37.1, humidity: 55, wind: 3.5 },
  "Pratapgarh": { temp: 36.9, humidity: 58, wind: 3.6 },
  "Sant Kabir Nagar": { temp: 34.7, humidity: 62, wind: 3.7 },
  "Shahjahanpur": { temp: 33.0, humidity: 60, wind: 4.9 },
  "Shamli": { temp: 36.0, humidity: 63, wind: 3.2 },
  "Shravasti": { temp: 36.6, humidity: 61, wind: 3.5 },
  "Siddharthnagar": { temp: 34.2, humidity: 75, wind: 3.5 },
  "Sonbhadra": { temp: 36.0, humidity: 57, wind: 4.2 },
  "Sultanpur": { temp: 33.2, humidity: 65, wind: 4.5 },
  "Unnao": { temp: 35.7, humidity: 70, wind: 3.9 },
  "Gautam Buddha Nagar": { temp: 34.7, humidity: 58, wind: 3.9 },
  "Amroha": { temp: 35.5, humidity: 66, wind: 3.9 },
  "Baghpat": { temp: 35.2, humidity: 70, wind: 4.3 },
  "Balrampur": { temp: 35.9, humidity: 61, wind: 4.2 },
  "Amethi": { temp: 37.0, humidity: 55, wind: 3.1 },
  "Mau Nath Bhanjan": { temp: 35.4, humidity: 59, wind: 4.1 },
};

function computeHeatScore(city: typeof UP_CITIES[0], temp: number, humidity: number, wind: number): {
  score: number;
  zone: string;
  vehicleDensity: number;
  greenCoverRatio: number;
  builtUpRatio: number;
  coolingIndex: number;
  trafficHeatFactor: number;
} {
  const vehicleDensity = city.totalVehicles / city.totalArea;
  const greenCoverRatio = (city.forestCover + city.urbanGreenSpace) / 100;
  const builtUpRatio = city.builtUpArea / city.totalArea;
  const trafficHeatFactor = city.petrolVehicles + city.dieselVehicles;
  const coolingIndex = greenCoverRatio * Math.max(wind, 0.5);

  const tempScore = Math.max(0, Math.min(1, (temp - 20) / 28)) * 30;
  const humidityScore = Math.max(0, Math.min(1, (humidity - 20) / 80)) * 15;
  const vehicleScore = Math.max(0, Math.min(1, (vehicleDensity - 50) / 4950)) * 20;
  const popDensScore = Math.max(0, Math.min(1, (city.populationDensity - 500) / 29500)) * 10;
  const builtUpScore = Math.max(0, Math.min(1, (builtUpRatio - 0.2) / 0.7)) * 15;
  const greenPenalty = (1 - Math.max(0, Math.min(1, greenCoverRatio / 0.5))) * 10;
  const coolingBonus = Math.max(0, Math.min(1, coolingIndex / 0.5)) * 5;

  const raw = tempScore + humidityScore + vehicleScore + popDensScore + builtUpScore + greenPenalty - coolingBonus;
  const score = Math.min(100, Math.max(0, Math.round(raw * 10) / 10));

  let zone = "cool";
  if (score > 50) zone = "extreme";
  else if (score >= 30) zone = "high";
  else if (score >= 20) zone = "moderate";

  return { score, zone, vehicleDensity, greenCoverRatio, builtUpRatio, coolingIndex, trafficHeatFactor };
}

async function seed() {
  console.log("🌱 Seeding WeatherGPT database...");
  await db.delete(recommendationsTable);
  await db.delete(heatPredictionsTable);
  await db.delete(weatherDataTable);
  await db.delete(citiesTable);

  for (const cityData of UP_CITIES) {
    const [city] = await db.insert(citiesTable).values(cityData).returning();
    if (!city) continue;

    console.log(`  📍 Seeded city: ${city.name}`);

    const base = WEATHER_BASE[city.name]!;

    for (let i = 10; i >= 0; i--) {
      const offset = i * 30;
      const tempVariation = (Math.random() - 0.5) * 4;
      const humidVariation = Math.floor((Math.random() - 0.5) * 10);
      const windVariation = (Math.random() - 0.5) * 2;
      const temp = Math.round((base.temp + tempVariation) * 10) / 10;
      const humidity = Math.max(30, Math.min(98, base.humidity + humidVariation));
      const wind = Math.max(0.5, Math.round((base.wind + windVariation) * 10) / 10);

      const recordedAt = new Date(Date.now() - offset * 60 * 1000);

      const [weather] = await db.insert(weatherDataTable).values({
        cityId: city.id,
        temperature: temp,
        feelsLike: Math.round((temp + 2) * 10) / 10,
        humidity,
        windSpeed: wind,
        pressure: 1000 + Math.floor(Math.random() * 15),
        cloudCover: Math.floor(Math.random() * 50),
        rainfall: 0,
        weatherMain: temp > 35 ? "Haze" : "Clear",
        weatherDescription: temp > 35 ? "haze" : "clear sky",
      }).returning();

      if (!weather) continue;

      const heat = computeHeatScore(city, temp, humidity, wind);

      await db.insert(heatPredictionsTable).values({
        cityId: city.id,
        heatRiskScore: heat.score,
        heatZone: heat.zone,
        temperature: temp,
        humidity,
        vehicleDensity: heat.vehicleDensity,
        populationDensity: city.populationDensity,
        greenCoverRatio: heat.greenCoverRatio,
        builtUpRatio: heat.builtUpRatio,
        coolingIndex: heat.coolingIndex,
        trafficHeatFactor: heat.trafficHeatFactor,
        predictedAt: recordedAt,
      });
    }

    const latestHeat = computeHeatScore(city, base.temp, base.humidity, base.wind);
    const recs: Array<{
      cityId: number;
      category: string;
      title: string;
      description: string;
      priority: string;
      impact: string;
      icon: string;
    }> = [];

    if (latestHeat.greenCoverRatio < 0.15) {
      recs.push({
        cityId: city.id,
        category: "Greenery",
        title: "Urban Tree Plantation Drive",
        description: `${city.name}'s green cover ratio is critically low at ${(latestHeat.greenCoverRatio * 100).toFixed(1)}%. Launch a city-wide tree plantation program targeting 10,000+ trees in residential and commercial zones.`,
        priority: latestHeat.score > 70 ? "critical" : "high",
        impact: "Can reduce surface temperature by 3-5°C in planted zones",
        icon: "TreePine",
      });
    }

    if (latestHeat.vehicleDensity > 800) {
      recs.push({
        cityId: city.id,
        category: "Transportation",
        title: "Odd-Even Vehicle Regulation",
        description: `Vehicle density in ${city.name} is ${latestHeat.vehicleDensity.toFixed(0)} vehicles/km². Implement odd-even traffic regulations and promote CNG/electric vehicle adoption.`,
        priority: latestHeat.vehicleDensity > 2500 ? "critical" : "high",
        impact: "Reduce vehicular heat emissions by up to 25% in peak hours",
        icon: "Car",
      });
    }

    if (city.petrolVehicles + city.dieselVehicles > city.totalVehicles * 0.7) {
      recs.push({
        cityId: city.id,
        category: "Transportation",
        title: "Electric Vehicle Transition Incentive",
        description: `${city.name} has ${(((city.petrolVehicles + city.dieselVehicles) / city.totalVehicles) * 100).toFixed(0)}% fossil fuel vehicles. Subsidize EV purchases and expand CNG infrastructure.`,
        priority: "medium",
        impact: "Transitioning 30% of vehicles to EV/CNG can cut heat emissions by 20%",
        icon: "Zap",
      });
    }

    if (latestHeat.builtUpRatio > 0.55) {
      recs.push({
        cityId: city.id,
        category: "Urban Infrastructure",
        title: "Cool Roofs & Reflective Pavements",
        description: `${city.name}'s built-up ratio is ${(latestHeat.builtUpRatio * 100).toFixed(0)}%. Mandate cool roof coatings (reflectivity > 0.65) for new constructions and apply reflective materials on key roads.`,
        priority: latestHeat.builtUpRatio > 0.7 ? "high" : "medium",
        impact: "Cool roofs reduce indoor temperature by 2-4°C and urban air temp by 1-2°C",
        icon: "Building2",
      });
    }

    if (latestHeat.coolingIndex < 0.08) {
      recs.push({
        cityId: city.id,
        category: "Urban Planning",
        title: "Green Urban Corridors",
        description: `Low cooling index (${latestHeat.coolingIndex.toFixed(3)}) suggests poor airflow and minimal vegetation. Design green corridors along major roads.`,
        priority: "high",
        impact: "Green corridors improve urban cooling by 1.5-3°C in surrounding areas",
        icon: "Wind",
      });
    }

    recs.push({
      cityId: city.id,
      category: "Public Awareness",
      title: "Heat Action Plan & Early Warning System",
      description: `Establish a city-level heat action plan with early warning SMS alerts, cooling centers, and public health advisories during peak summer months.`,
      priority: latestHeat.score > 60 ? "high" : "medium",
      impact: "Early warning systems reduce heat-related mortality by up to 40%",
      icon: "Bell",
    });

    if (city.industrialArea / city.totalArea > 0.12) {
      recs.push({
        cityId: city.id,
        category: "Industrial",
        title: "Industrial Heat Emission Controls",
        description: `Industrial zones occupy ${((city.industrialArea / city.totalArea) * 100).toFixed(1)}% of ${city.name}. Enforce heat emission standards and require green buffer zones.`,
        priority: "medium",
        impact: "Reduce localized industrial heat contribution by 15-30%",
        icon: "Factory",
      });
    }

    if (recs.length > 0) {
      await db.insert(recommendationsTable).values(recs);
    }

    console.log(`    ✅ ${city.name}: heat score=${latestHeat.score}, zone=${latestHeat.zone}, recs=${recs.length}`);
  }

  console.log("\n✅ Seed complete!");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
