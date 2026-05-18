// ─── Init ─────────────────────────────────────────────────────────────────────

function initCameras() {
    camera = new THREE.PerspectiveCamera(60, ar, 0.1, 10000000);
    camera.position.set(-30, 20, 30);
    camera.lookAt(0, 0, 0);
    camera.layers.enable(skyboxLayer);

    cameraControls = new THREE.OrbitControls(camera, renderer.domElement);
    cameraControls.target.set(0, 1, 0);
    cameraControls.enableKeys = false;
    cameraControls.update();

    scene.add(camera);
    updateAspectRatio();

    // Mini-map orthographic camera
    updateMiniSide();
    minicam = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 10000000);
    minicam.position.set(0, 0, miniCamDist);
    minicam.lookAt(0, 0, 0);
    scene.add(minicam);
}

// ─── Resize helpers ───────────────────────────────────────────────────────────

function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    ar = window.innerWidth / window.innerHeight;
    camera.aspect = ar;
    camera.updateProjectionMatrix();
    updateMiniSide();
}

function updateMiniSide() {
    miniSide = window.innerHeight / 2.0;
    if (window.innerWidth < window.innerHeight) miniSide = window.innerWidth / 2.0;
}

// ─── Per-frame updates ────────────────────────────────────────────────────────

function updateCamera() {
    if (rocket != null) {
        velocityLerp = lerp(minSpeed, maxSpeed, rocket.body.velocity.length());

        var destination, radius;
        if (controller.camDistance == 1) {
            destination = planet.body.position;
            radius = planetRadius;
        } else if (controller.camDistance == 2) {
            destination = satellite.body.position;
            radius = satelliteColliderRadius;
        } else if (controller.camDistance == 3) {
            destination = centralObject.body.position;
            radius = (centralObject == planet) ? planetRadius : satelliteColliderRadius;
        }

        if (controller.camDistance != 0) {
            distanceLerp = lerp(radius, 10 * radius, destination.vsub(rocket.body.position).length());
        } else {
            distanceLerp = 0.05;
        }
    }

    if (rocket == null || controller.camRotation == 0) {
        // Orbit-controls mode
        cameraControls.enabled = true;
        cameraControls.update();

        var pos = new THREE.Vector3();
        if (controller.camDistance == 1) {
            planet.visual.getWorldPosition(pos);
        } else if (controller.camDistance == 2) {
            satellite.visual.getWorldPosition(pos);
        } else if (rocket != null) {
            if (controller.camDistance == 3) centralObject.visual.getWorldPosition(pos);
            else rocket.visual.getWorldPosition(pos);
        }

        cameraControls.target.set(pos.x, pos.y, pos.z);

        if (!wasUsingOrbitControls) {
            cameraControls.reset();
            camera.up = new THREE.Vector3(0, 1, 0);
            wasUsingOrbitControls = true;
        }
    } else {
        // Follow-rocket mode
        cameraControls.enabled = false;

        var cameraDist = inverseLerp(minCameraDist, maxCameraDist, distanceLerp);
        camera.position.x = rocket.body.position.x;
        camera.position.y = rocket.body.position.y;
        camera.position.z = cameraDist;
        camera.lookAt(rocket.visual.position);

        var grav = rocket.gravityDir;
        if (controller.camRotation == 1) {
            camera.up = new THREE.Vector3(-grav.x, -grav.y, -grav.z);
        } else if (controller.camRotation == 2) {
            var yDir = new THREE.Vector3(0, 1, 0).applyQuaternion(rocket.visual.quaternion);
            camera.up = new THREE.Vector3(yDir.x, yDir.y, yDir.z);
        } else if (controller.camRotation == 3) {
            camera.up = new THREE.Vector3(0, 1, 0);
        }

        if (wasUsingOrbitControls) wasUsingOrbitControls = false;
    }
}

function updateMiniCam() {
    if (rocket == null) return;

    var zoom = 0;
    var worldPos = new THREE.Vector3();

    if (controller.miniCam == 0) {
        rocket.visual.getWorldPosition(worldPos);
        zoom = inverseLerp(minZoom, maxZoom, velocityLerp);
    } else if (controller.miniCam == 1) {
        planet.visual.getWorldPosition(worldPos);
        zoom = miniCamPlanetZoom;
    } else if (controller.miniCam == 2) {
        satellite.visual.getWorldPosition(worldPos);
        zoom = miniCamSatelliteZoom;
    } else if (controller.miniCam == 3) {
        if (distanceLerp < 0.1) {
            if (centralObject == satellite) {
                satellite.visual.getWorldPosition(worldPos);
                zoom = miniCamSatelliteZoom;
            } else {
                planet.visual.getWorldPosition(worldPos);
                zoom = miniCamPlanetZoom;
            }
        } else {
            rocket.visual.getWorldPosition(worldPos);
            zoom = inverseLerp(minZoom, maxZoom, velocityLerp);
        }
    }

    minicam.position.x = worldPos.x;
    minicam.position.y = worldPos.y;
    minicam.left   = -zoom;
    minicam.right  =  zoom;
    minicam.top    =  zoom;
    minicam.bottom = -zoom;
    minicam.updateProjectionMatrix();
}

// ─── Mouse wheel zoom ─────────────────────────────────────────────────────────

function onMouseWheel(event) {
    if (rocket != null) {
        if (event.deltaY > 1) {
            maxCameraDist += 1000;
        } else {
            if (maxCameraDist > 0) maxCameraDist -= 1000;
        }
    }
}
