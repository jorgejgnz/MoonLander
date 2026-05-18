// ─── Renderer / Scene ─────────────────────────────────────────────────────────
var container, renderer, scene;

// ─── Scene objects ────────────────────────────────────────────────────────────
var physicalObjects = [];
var planet, satellite, rocket;
var system, orbitCenter;
var rocketModel;
var sun, ambientLight;
var centralObject;
var atmosphereAsset;

// ─── Materials ────────────────────────────────────────────────────────────────
var defaultMat;
var collectableMat;
var colliderMat;
var atmosphereMat;

// ─── Animation ────────────────────────────────────────────────────────────────
var clock = new THREE.Clock();
var prevDate = Date.now();
var deltaTime = 0;
var gameTime = 0;

// ─── Cameras ──────────────────────────────────────────────────────────────────
var camera, minicam;
var ar;
var miniSide = 200;
var wasUsingOrbitControls = false;

var minCameraDist = 100;
var maxCameraDist = 10000;
var maxZoom = 1000;
var minZoom = 25;
var minSpeed = 10;
var maxSpeed = 1000;
var miniCamDist = 100;
var miniCamPlanetZoom = 10000;
var miniCamSatelliteZoom = 5000;

// ─── Interaction ──────────────────────────────────────────────────────────────
var cameraControls;
var stats;
var keyboard;
var controller;

// ─── Physics ──────────────────────────────────────────────────────────────────
const G = 6.674e-1;
var world;
var physMat;
var velocityLerp, distanceLerp;
var gravityThreshold = 1.0;
var trashCan = [];
var prevSatellitePos;
var satelliteVel;
var satelliteVelLength;

// ─── Solar system ─────────────────────────────────────────────────────────────
var planetRadius = 500;
var satelliteRadius = 200;
var satelliteVisualScale = 0.97; // mesh is slightly smaller than the raw radius constant
var satelliteColliderRadius = satelliteRadius * satelliteVisualScale;
var satelliteDistance = 2500.0;
var satelliteSpeed = Math.PI * 0.005;
var planetSpeed = 0.005;
var planetMass = 2.5e7;
var satelliteMass = 2.5e6;

// ─── Bonus ────────────────────────────────────────────────────────────────────
var numBonus = 10;
var bonusRadius = 10;
var distBetweenOrbits = 350;
var fuelPerBonus = 0.1;

// ─── Rocket ───────────────────────────────────────────────────────────────────
var startPos = new CANNON.Vec3(0, 20, 0);
var thrusting, wantsRotateL, wantsRotateR = false;
var rotatedL, rotatedR = false;
var thrustIntensity = 250.0;
var torqueIntensity = 2000.0;
var arrowHelper;
var rocketLight;
var rocketLightIntensity = 2;
var fuel = 1;
var fuelPerPulse = 0.001;
var rocketDryMass = 1.0;
var rocketFuelMass = 1.0;
var maxRocketSpeed = 2000;
var bottomCone, leftCone, rightCone;
var distToPlanet, distToSatellite;

// ─── Assets ───────────────────────────────────────────────────────────────────
var assets, rocketAsset, planetAsset, satelliteAsset, starAsset;
var textureLoader, cubeTextureLoader, cubeTexture;
var skyboxLayer = 1;

// ─── UI / Score ───────────────────────────────────────────────────────────────
var finished = false;
var score = -3;
var bestscore = null;
var uiScore, uiHighscore;
var uiFuel;
var uiControls;
var uiRotateL, uiRotateR, uiThrust;
