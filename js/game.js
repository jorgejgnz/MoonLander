// ─── Entry point ──────────────────────────────────────────────────────────────

function init() {
    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(new THREE.Color(0x000000), 1.0);
    renderer.autoClear = false;

    container = document.getElementById('container');
    container.appendChild(renderer.domElement);

    ar = window.innerWidth / window.innerHeight;
    textureLoader = new THREE.TextureLoader();

    window.addEventListener('resize', updateAspectRatio);
    window.addEventListener('wheel',  onMouseWheel);

    // Cache UI element references
    uiScore     = document.getElementById('uiScore');
    uiHighscore = document.getElementById('uiHighscore');
    uiFuel      = document.getElementById('uiFuel');
    uiControls  = document.getElementById('uiControls');
    uiRotateL   = document.getElementById('uiRotateL');
    uiRotateR   = document.getElementById('uiRotateR');
    uiThrust    = document.getElementById('uiThrust');

    initCameras();
    initInput();
    initPhysics();
    initScene();
    initGui();
    initStats();
}

// ─── Main loop ────────────────────────────────────────────────────────────────

function update() {
    deltaTime = (Date.now() - prevDate) / 1000;
    gameTime += deltaTime;

    // Rotate planet and orbit system
    orbitCenter.rotation.z  -= satelliteSpeed * deltaTime;
    planet.visual.rotation.z -= planetSpeed   * deltaTime;

    // Track satellite velocity for relative-velocity calculations
    if (rocket != null) {
        var displacement = satellite.body.position.vsub(prevSatellitePos);
        satelliteVelLength = displacement.length() / deltaTime;
        satelliteVel = displacement.unit().scale(satelliteVelLength); // unit() + scale() return new vectors
        prevSatellitePos.copy(satellite.body.position);
    }

    // BEFORE step: sync kinematic body velocities from scene-graph motion, and
    // apply gravity forces so the solver can balance them with contact forces.
    cleanTrashCan();
    for (var i = 0; i < physicalObjects.length; i++) {
        if (physicalObjects[i].enabled) {
            updateKinematicVelocity(physicalObjects[i]);
            updateGravity(physicalObjects[i]);
        }
    }
    world.step(deltaTime);
    // AFTER step: copy resulting body transforms back to their visuals.
    for (var i = 0; i < physicalObjects.length; i++) {
        if (physicalObjects[i].enabled) matchPhysicalObject(physicalObjects[i]);
    }

    // Rocket logic + atmosphere billboard
    if (rocket != null) {
        updateRocket();
        updateTrajectory();
        updateScore();

        if (cameraControls.enabled) {
            atmosphereAsset.lookAt(camera.position);
            atmosphereAsset.rotateX(Math.PI / 2.0);
        } else {
            atmosphereAsset.rotation.y = atmosphereAsset.rotation.z = 0.0;
            atmosphereAsset.rotation.x = Math.PI / 2.0;
        }
    }

    // Update GUI-driven settings
    updateController(controller);

    // Determine which body the rocket is closest to
    if (rocket != null) {
        var rocketPos    = rocket.body.position;
        var planetPos    = planet.body.position;
        var satellitePos = satellite.body.position;
        centralObject = (planetPos.vsub(rocketPos).length() < satellitePos.vsub(rocketPos).length())
            ? planet
            : satellite;
    } else {
        centralObject = planet;
    }

    updateCamera();
    updateMiniCam();
    stats.update();

    uiControls.style.visibility = controller.controls ? 'visible' : 'hidden';

    prevDate = Date.now();
}

function render() {
    requestAnimationFrame(render);
    update();

    renderer.clear();

    // Main view — full viewport
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);

    // Mini-map — bottom-left corner
    renderer.setViewport(0, 0, miniSide, miniSide);
    renderer.setScissor(0, 0, miniSide, miniSide);
    renderer.setScissorTest(true);
    renderer.clear();
    renderer.setScissorTest(false);
    renderer.render(scene, minicam);
}

window.onload = function () {
    init();
    render();
};
