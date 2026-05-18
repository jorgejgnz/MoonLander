// ─── Scene init ───────────────────────────────────────────────────────────────

function initScene() {
    defaultMat    = new THREE.MeshPhongMaterial({ color: 0xFFAAAA });
    colliderMat   = new THREE.MeshLambertMaterial({ color: 0xFFFFFF, opacity: 0.1, transparent: true });
    collectableMat = new THREE.MeshBasicMaterial({ color: 0x00FF00 });

    scene.add(new THREE.AxisHelper(5));

    // Lighting
    sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(0, 0, 1);
    scene.add(sun);

    ambientLight = new THREE.HemisphereLight(0xaaaaff, 0x0000ff, 0.5);
    ambientLight.position.set(0, 1, 0);
    scene.add(ambientLight);

    // Skybox
    cubeTextureLoader = new THREE.CubeTextureLoader();
    cubeTextureLoader.setPath('images/skybox/');
    cubeTexture = cubeTextureLoader.load([
        'posx.png', 'negx.png',
        'posy.png', 'negy.png',
        'posz.png', 'negz.png'
    ]);
    setupEnvironment(cubeTexture, 20000, skyboxLayer);

    // Planet & satellite physics bodies
    planet    = new Sphere('planet',    planetRadius,    new CANNON.Vec3(0, 0, 0),                physMat, colliderMat, 0.0);
    satellite = new Sphere('satellite', satelliteColliderRadius, new CANNON.Vec3(0, satelliteDistance, 0), physMat, colliderMat, 0.0);

    // The satellite is moved by the scene graph (orbitCenter rotation) every
    // frame. As a STATIC body it would teleport into the rocket, producing a
    // penetration "kick" each frame. KINEMATIC bodies have infinite mass (no
    // forces affect them) but their .velocity IS used by the contact solver,
    // so the rocket gets carried along by friction instead of being kicked out.
    satellite.body.type = CANNON.Body.KINEMATIC;
    satellite.body.updateMassProperties();

    // Scene graph hierarchy
    system = new THREE.Object3D();
    system.position.y = -planetRadius;
    system.add(planet.visual);

    orbitCenter = new THREE.Object3D();
    orbitCenter.add(satellite.visual);
    orbitCenter.rotation.z = Math.random() * Math.PI * 2;
    system.add(orbitCenter);

    scene.add(system);

    matchPhysicalObject(planet);
    matchPhysicalObject(satellite);

    // Load all 3D assets from a single glTF file
    importModelFromGltf('models/rocket/assets.glb', 'assets', function (gltf) {
        assets = gltf.scene;

        rocketAsset    = assets.getObjectByName('rocket');
        planetAsset    = assets.getObjectByName('planet');
        satelliteAsset = assets.getObjectByName('satellite');

        setupRocket(rocketAsset);
        setupPlanet(planetAsset);
        setupSatellite(satelliteAsset);

        for (var i = 0; i < numBonus; i++) {
            setupBonus(bonusRadius, 0.05, (i + 1) * distBetweenOrbits);
        }
    });
}

// ─── Object setups ────────────────────────────────────────────────────────────

function setupPlanet(planetAsset) {
    planetAsset.position = new THREE.Vector3(0, 0, 0);
    planetAsset.scale.x = planetAsset.scale.y = planetAsset.scale.z = planetRadius * 1.025;

    loadTexturedMaterial('models/rocket/', 'atmos-alpha.png', 1, 1, function (mat) {
        atmosphereAsset = planetAsset.getObjectByName('atmosphere');

        atmosphereMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb });
        atmosphereMat.map = mat.map;
        atmosphereMat.alphaMap = mat.map;
        atmosphereMat.transparent = true;
        atmosphereMat.opacity = 0.5;

        atmosphereAsset.material = atmosphereMat;
    });

    planet.visual.add(planetAsset);
}

function setupSatellite(satelliteAsset) {
    satelliteAsset.position = new THREE.Vector3(0, 0, 0);
    satelliteAsset.scale.x = satelliteAsset.scale.y = satelliteAsset.scale.z = satelliteColliderRadius;

    satellite.visual.add(satelliteAsset);

    prevSatellitePos = new CANNON.Vec3(
        satelliteAsset.position.x,
        satelliteAsset.position.y,
        satelliteAsset.position.z
    );
}

function setupBonus(radius, mass, distToSurface) {
    var bonus = new Sphere(
        'bonus',
        radius,
        planet.body.position.vadd(new CANNON.Vec3(0, planetRadius + distToSurface, 0)),
        physMat,
        collectableMat,
        mass
    );
    orbit(bonus.body, planetMass, planetRadius + distToSurface);
}
