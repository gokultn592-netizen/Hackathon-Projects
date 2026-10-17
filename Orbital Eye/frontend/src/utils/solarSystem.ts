/**
 * OrbitalEye Solar System & Deep Space Astrodynamics Module
 * Heliocentric coordinates (HCI), Keplerian orbital elements, and planetary parameters.
 */
import * as THREE from 'three';

export interface CelestialBodyData {
  id: string;
  name: string;
  subtitle: string;
  type: 'STAR' | 'PLANET' | 'MOON' | 'LAGRANGE' | 'PROBE';
  color: string;
  glowColor: string;
  radiusUnits: number; // Visual sphere radius
  actualRadiusKm: number;
  semiMajorAxisAU: number; // 1 AU = Sun-Earth distance
  eccentricity: number;
  inclinationDeg: number;
  orbitalPeriodDays: number;
  rotationPeriodHours: number;
  meanVelocityKms: number;
  moonsCount: number;
  hasRings?: boolean;
  ringInnerUnits?: number;
  ringOuterUnits?: number;
  description: string;
  missions: string[];
  scientificFacts: {
    surfaceGravity: string;
    temperatureRange: string;
    atmosphere: string;
  };
}

// Visual distance scale: 1 AU = 40.0 3D scene units
export const AU_SCALE = 40.0;

export const PLANETARY_BODIES: CelestialBodyData[] = [
  {
    id: 'sun',
    name: 'THE SUN (SOL)',
    subtitle: 'Yellow Dwarf G2V Star · Solar System Center',
    type: 'STAR',
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.85)',
    radiusUnits: 7.5,
    actualRadiusKm: 696340,
    semiMajorAxisAU: 0.0,
    eccentricity: 0.0,
    inclinationDeg: 0.0,
    orbitalPeriodDays: 0,
    rotationPeriodHours: 609.1,
    meanVelocityKms: 0.0,
    moonsCount: 8,
    description: 'Central gravitational anchor of the solar system, containing 99.86% of the system mass and driving space weather via coronal mass ejections (CMEs).',
    missions: ['Parker Solar Probe', 'SOHO', 'Solar Orbiter'],
    scientificFacts: {
      surfaceGravity: '274.0 m/s² (28g)',
      temperatureRange: '5,500°C (Surface) · 15,000,000°C (Core)',
      atmosphere: '74% Hydrogen · 24% Helium Plasma',
    },
  },
  {
    id: 'mercury',
    name: 'MERCURY',
    subtitle: 'Innermost Terrestrial Planet',
    type: 'PLANET',
    color: '#94a3b8',
    glowColor: 'rgba(148, 163, 184, 0.6)',
    radiusUnits: 1.1,
    actualRadiusKm: 2439.7,
    semiMajorAxisAU: 0.387,
    eccentricity: 0.2056,
    inclinationDeg: 7.0,
    orbitalPeriodDays: 87.97,
    rotationPeriodHours: 1407.6,
    meanVelocityKms: 47.36,
    moonsCount: 0,
    description: 'Heavily cratered, dense iron-core world with the highest orbital speed and highest orbital eccentricity of the 8 major planets.',
    missions: ['MESSENGER', 'BepiColombo', 'Mariner 10'],
    scientificFacts: {
      surfaceGravity: '3.7 m/s² (0.38g)',
      temperatureRange: '-180°C to +430°C',
      atmosphere: 'Trace Exosphere (Oxygen, Sodium, Hydrogen)',
    },
  },
  {
    id: 'venus',
    name: 'VENUS',
    subtitle: 'Super-Heated Greenhouse World',
    type: 'PLANET',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.65)',
    radiusUnits: 1.9,
    actualRadiusKm: 6051.8,
    semiMajorAxisAU: 0.723,
    eccentricity: 0.0067,
    inclinationDeg: 3.39,
    orbitalPeriodDays: 224.7,
    rotationPeriodHours: -5832.5, // Retrograde rotation
    meanVelocityKms: 35.02,
    moonsCount: 0,
    description: 'Earth-sized terrestrial world cloaked in reflective sulfuric acid clouds and runaway carbon dioxide greenhouse pressure exceeding 92 atmospheres.',
    missions: ['Magellan', 'Venus Express', 'Akatsuki', 'DAVINCI+ (Upcoming)'],
    scientificFacts: {
      surfaceGravity: '8.87 m/s² (0.91g)',
      temperatureRange: '465°C Constant Mean',
      atmosphere: '96.5% Carbon Dioxide · 3.5% Nitrogen (92 bar)',
    },
  },
  {
    id: 'earth',
    name: 'EARTH (TERRA)',
    subtitle: 'OrbitalEye Prime Operational Theater',
    type: 'PLANET',
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.8)',
    radiusUnits: 2.1,
    actualRadiusKm: 6371.0,
    semiMajorAxisAU: 1.000,
    eccentricity: 0.0167,
    inclinationDeg: 0.0,
    orbitalPeriodDays: 365.25,
    rotationPeriodHours: 23.934,
    meanVelocityKms: 29.78,
    moonsCount: 1,
    description: 'Dynamic ocean world hosting thousands of artificial LEO/GEO satellites and collision warning assets monitored in OrbitalEye Mission Control.',
    missions: ['ISS', 'OrbitalEye Sensor Mesh', 'Hubble', 'Landsat'],
    scientificFacts: {
      surfaceGravity: '9.807 m/s² (1.0g)',
      temperatureRange: '-89°C to +58°C',
      atmosphere: '78% Nitrogen · 21% Oxygen · 1% Argon/CO₂',
    },
  },
  {
    id: 'moon',
    name: 'THE MOON (LUNA)',
    subtitle: 'Earth Natural Satellite · Cislunar Anchor',
    type: 'MOON',
    color: '#cbd5e1',
    glowColor: 'rgba(203, 213, 225, 0.5)',
    radiusUnits: 0.55, // Proportional to Earth (1,737km / 6,371km ~ 27.3% of 2.1 = 0.573)
    actualRadiusKm: 1737.4,
    semiMajorAxisAU: 1.0026, // Cislunar orbit (~384,400 km from Earth)
    eccentricity: 0.0549,
    inclinationDeg: 5.14,
    orbitalPeriodDays: 27.32,
    rotationPeriodHours: 655.7,
    meanVelocityKms: 1.022,
    moonsCount: 0,
    description: 'Tidally locked natural satellite in cislunar space; gateway for upcoming Artemis missions and Gateway lunar space station.',
    missions: ['Apollo', 'Artemis Program', 'Chandrayaan', 'LRO'],
    scientificFacts: {
      surfaceGravity: '1.62 m/s² (0.166g)',
      temperatureRange: '-130°C to +120°C',
      atmosphere: 'Extreme Ultra-Thin Exosphere',
    },
  },
  {
    id: 'mars',
    name: 'MARS',
    subtitle: 'The Red Planet · Deep Space Gateway',
    type: 'PLANET',
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.75)',
    radiusUnits: 1.45,
    actualRadiusKm: 3389.5,
    semiMajorAxisAU: 1.524,
    eccentricity: 0.0934,
    inclinationDeg: 1.85,
    orbitalPeriodDays: 686.98,
    rotationPeriodHours: 24.62,
    meanVelocityKms: 24.07,
    moonsCount: 2,
    description: 'Dry desert world with iron oxide regolith, Olympus Mons volcano, and a growing constellation of interplanetary robotic explorers.',
    missions: ['Perseverance Rover', 'Curiosity', 'Mars Reconnaissance Orbiter', 'Hope Probe'],
    scientificFacts: {
      surfaceGravity: '3.72 m/s² (0.38g)',
      temperatureRange: '-140°C to +20°C',
      atmosphere: '95.3% Carbon Dioxide · 2.6% Nitrogen (0.006 bar)',
    },
  },
  {
    id: 'jupiter',
    name: 'JUPITER',
    subtitle: 'Gas Giant · Cosmic Shield of the Inner System',
    type: 'PLANET',
    color: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.8)',
    radiusUnits: 4.8,
    actualRadiusKm: 69911,
    semiMajorAxisAU: 2.75, // Visually scaled for tight interactive viewport
    eccentricity: 0.0489,
    inclinationDeg: 1.30,
    orbitalPeriodDays: 4332.6,
    rotationPeriodHours: 9.93,
    meanVelocityKms: 13.07,
    moonsCount: 95,
    description: 'Colossal gas giant with intense radiation belts, the Great Red Spot storm, and four massive Galilean moons (Io, Europa, Ganymede, Callisto).',
    missions: ['Juno', 'Galileo', 'Voyager 1 & 2', 'JUICE (En Route)'],
    scientificFacts: {
      surfaceGravity: '24.79 m/s² (2.53g)',
      temperatureRange: '-110°C (Cloud Top)',
      atmosphere: '90% Hydrogen · 10% Helium Banded Storms',
    },
  },
  {
    id: 'saturn',
    name: 'SATURN',
    subtitle: 'The Ringed Planet',
    type: 'PLANET',
    color: '#eab308',
    glowColor: 'rgba(234, 179, 8, 0.75)',
    radiusUnits: 4.0,
    actualRadiusKm: 58232,
    semiMajorAxisAU: 3.75, // Visually scaled
    eccentricity: 0.0565,
    inclinationDeg: 2.49,
    orbitalPeriodDays: 10759.2,
    rotationPeriodHours: 10.7,
    meanVelocityKms: 9.68,
    moonsCount: 146,
    hasRings: true,
    ringInnerUnits: 5.2,
    ringOuterUnits: 8.8,
    description: 'Spectacular gas giant encircled by vast icy rings of shattered comets and asteroids, orbiting with Titan and ocean world Enceladus.',
    missions: ['Cassini-Huygens', 'Voyager 1 & 2', 'Dragonfly (Upcoming)'],
    scientificFacts: {
      surfaceGravity: '10.44 m/s² (1.06g)',
      temperatureRange: '-140°C (Cloud Top)',
      atmosphere: '96% Hydrogen · 3% Helium · 0.4% Methane',
    },
  },
  {
    id: 'uranus',
    name: 'URANUS',
    subtitle: 'Tilted Ice Giant',
    type: 'PLANET',
    color: '#2dd4bf',
    glowColor: 'rgba(45, 212, 191, 0.65)',
    radiusUnits: 2.6,
    actualRadiusKm: 25362,
    semiMajorAxisAU: 4.65, // Visually scaled
    eccentricity: 0.0463,
    inclinationDeg: 0.77,
    orbitalPeriodDays: 30685.4,
    rotationPeriodHours: -17.24, // Extreme 97.8° axial tilt
    meanVelocityKms: 6.80,
    moonsCount: 28,
    description: 'Pale cyan ice giant rotating on its side at a 98° axial tilt, enveloped by water, ammonia, and methane ices over a rocky core.',
    missions: ['Voyager 2 (1986 Flyby)'],
    scientificFacts: {
      surfaceGravity: '8.69 m/s² (0.89g)',
      temperatureRange: '-224°C Coldest Planetary Atmosphere',
      atmosphere: '83% Hydrogen · 15% Helium · 2% Methane',
    },
  },
  {
    id: 'neptune',
    name: 'NEPTUNE',
    subtitle: 'Deep Blue Supersonic Wind World',
    type: 'PLANET',
    color: '#3b82f6',
    glowColor: 'rgba(59, 130, 246, 0.75)',
    radiusUnits: 2.5,
    actualRadiusKm: 24622,
    semiMajorAxisAU: 5.5, // Visually scaled
    eccentricity: 0.0095,
    inclinationDeg: 1.77,
    orbitalPeriodDays: 60190.0,
    rotationPeriodHours: 16.11,
    meanVelocityKms: 5.43,
    moonsCount: 16,
    description: 'Outermost major planet experiencing the fastest recorded supersonic winds in the solar system, exceeding 2,100 km/h.',
    missions: ['Voyager 2 (1989 Flyby)'],
    scientificFacts: {
      surfaceGravity: '11.15 m/s² (1.14g)',
      temperatureRange: '-218°C',
      atmosphere: '80% Hydrogen · 19% Helium · 1.5% Methane',
    },
  },
  {
    id: 'jwst-l2',
    name: 'JWST @ SUN-EARTH L2',
    subtitle: 'Deep Space Infrared Observatory',
    type: 'LAGRANGE',
    color: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 0.8)',
    radiusUnits: 0.65,
    actualRadiusKm: 20,
    semiMajorAxisAU: 1.010,
    eccentricity: 0.0167,
    inclinationDeg: 0.0,
    orbitalPeriodDays: 365.25,
    rotationPeriodHours: 0,
    meanVelocityKms: 29.78,
    moonsCount: 0,
    description: 'Halo orbit at Sun-Earth Lagrange Point 2, 1.5 million km behind Earth, peering 13.5 billion years into cosmic dawn.',
    missions: ['NASA / ESA / CSA Flagship Observatory'],
    scientificFacts: {
      surfaceGravity: '0.0001 m/s² (Microgravity)',
      temperatureRange: '-233°C (Cryogenic Shadow)',
      atmosphere: 'Deep Interplanetary Vacuum',
    },
  },
];

/**
 * Calculates high-accuracy 3D Heliocentric Cartesian Position for a celestial body
 * given elapsed simulation time in seconds.
 */
export function calculateHeliocentricPosition(
  body: CelestialBodyData,
  timeSec: number,
  speedMultiplier: number = 1.0
): THREE.Vector3 {
  if (body.semiMajorAxisAU === 0.0) {
    return new THREE.Vector3(0, 0, 0); // Sun is at origin
  }

  const orbitRadius = body.semiMajorAxisAU * AU_SCALE;
  // Angular velocity omega = 2pi / T
  // Normalized speed factor so planets orbit at visually pleasing comparative rates
  const speed = (2 * Math.PI) / (Math.max(10, body.orbitalPeriodDays) * 0.15) * speedMultiplier;
  const angle = timeSec * speed * 0.05;

  const incRad = (body.inclinationDeg * Math.PI) / 180;

  // Keplerian elliptical distortion
  const r = orbitRadius * (1 - body.eccentricity * Math.cos(angle));

  // Heliocentric plane coordinates (X-Z orbital plane, Y inclination offset)
  const x = r * Math.cos(angle);
  const z = r * Math.sin(angle);
  const y = r * Math.sin(angle) * Math.sin(incRad);

  return new THREE.Vector3(x, y, z);
}

/**
 * Generates an elliptical 3D line loop for planetary orbits
 */
export function generateOrbitPathPoints(body: CelestialBodyData, segments: number = 128): THREE.Vector3[] {
  if (body.semiMajorAxisAU === 0.0) return [];

  const points: THREE.Vector3[] = [];
  const orbitRadius = body.semiMajorAxisAU * AU_SCALE;
  const incRad = (body.inclinationDeg * Math.PI) / 180;

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const r = orbitRadius * (1 - body.eccentricity * Math.cos(angle));

    const x = r * Math.cos(angle);
    const z = r * Math.sin(angle);
    const y = r * Math.sin(angle) * Math.sin(incRad);

    points.push(new THREE.Vector3(x, y, z));
  }

  return points;
}
