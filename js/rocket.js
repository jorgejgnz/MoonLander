// ─── Setup ────────────────────────────────────────────────────────────────────

function setupRocket(rocketAsset) {
    rocketAsset.position.y = -7.0;
    rocketAsset.rotation.y = -Math.PI * 0.7;
    rocketAsset.scale.set(4, 4, 4);

    rocket = new Cube('rocket', 15.0, 40.0, 15.0, new CANNON.Vec3(0, 0, 0).copy(startPos), physMat, colliderMat, rocketDryMass + rocketFuelMass);
    rocket.visual.add(rocketAsset);

    // Thrust flame cones
    bottomCone = new THREE.Mesh(
        new THREE.ConeGeometry(5, 30, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
    );
    bottomCone.position.y = -20;
    bottomCone.visible = false;
    rocket.visual.add(bottomCone);

    leftCone = new THREE.Mesh(
        new THREE.ConeGeometry(2, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    leftCone.position.set(10, 15, 0);
    leftCone.rotation.z = Math.PI / 2;
    leftCone.visible = false;
    rocket.visual.add(leftCone);

    rightCone = new THREE.Mesh(
        new THREE.ConeGeometry(2, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    rightCone.position.set(-10, 15, 0);
    rightCone.rotation.z = -Math.PI / 2;
    rightCone.visible = false;
    rocket.visual.add(rightCone);

    // Velocity arrow
    arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 0), 30.0, 0xffff00);
    scene.add(arrowHelper);

    // Point light under the engine
    rocketLight = new THREE.PointLight(0xffffff, rocketLightIntensity, 40.0);
    rocketLight.position.y = -15;
    rocket.visual.add(rocketLight);

    rocket.prevSpeed = 0;
    rocket.body.addEventListener('collide', collision);

    initTrajectory();
}

// ─── Per-frame update ─────────────────────────────────────────────────────────

function updateRocket() {
    fixRotation();

    var newSpeed = rocket.body.velocity.length();
    if (newSpeed - rocket.prevSpeed > 10) stop(rocket.body);
    rocket.prevSpeed = newSpeed;

    clampVelocity(rocket.body, maxRocketSpeed);

    // Velocity arrow — relative to chosen reference frame
    var dir = new CANNON.Vec3(0, 0, 0);
    dir.copy(rocket.body.velocity);

    if (controller.arrowRef == 1) {
        dir.vsub(satelliteVel);
    } else if (controller.arrowRef == 2 && centralObject == satellite) {
        dir.vsub(satelliteVel);
    }

    var length = 10.0 + dir.length();
    dir.normalize();
    arrowHelper.setDirection(dir);
    arrowHelper.setLength(length);
    arrowHelper.position.copy(rocket.visual.position);

    // On mobile, cancel held inputs when finger is lifted
    if (window.USER_IS_TOUCHING != undefined && !window.USER_IS_TOUCHING) {
        wantsRotateL = false;
        wantsRotateR = false;
        thrusting = false;
    }

    // Apply angular thrust left
    if (wantsRotateL && !rotatedL) {
        leftCone.visible = true;
        rotate(torqueIntensity);
        rotatedL = true;
    } else if (!wantsRotateL || rotatedL) {
        leftCone.visible = false;
    }

    // Apply angular thrust right
    if (wantsRotateR && !rotatedR) {
        rightCone.visible = true;
        rotate(-torqueIntensity);
        rotatedR = true;
    } else if (!wantsRotateR || rotatedR) {
        rightCone.visible = false;
    }

    // Apply main thrust
    if (thrusting) {
        thrust(thrustIntensity);
    } else {
        thrustEffect(false);
    }

    rocket.body.mass = rocketDryMass + fuel * rocketFuelMass;

    // Atmospheric drag near planet surface
    var toPlanet = planet.body.position.vsub(rocket.body.position);
    distToPlanet = toPlanet.length();

    var atmosphereHeight = 200.0;
    var maxAirFriction = 0.5;

    if (distToPlanet < planetRadius + 20.0) {
        rocket.body.linearDamping = 0.8;
    } else if (distToPlanet < planetRadius + atmosphereHeight) {
        var heightLerp = lerp(planetRadius, planetRadius + atmosphereHeight, distToPlanet);
        rocket.body.linearDamping = (1.0 - heightLerp) * maxAirFriction;
    } else {
        rocket.body.linearDamping = 0.0;
    }
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function thrust(intensity) {
    if (fuel > 0) {
        thrusting = true;
        rocket.body.applyLocalForce(new CANNON.Vec3(0, 1, 0).scale(intensity), new CANNON.Vec3(0, 0, 0));
        addFuel(-fuelPerPulse);
        thrustEffect(true);
    } else {
        thrustEffect(false);
    }
}

function rotate(intensity) {
    rocket.body.torque = rocket.body.torque.vadd(new CANNON.Vec3(0, 0, 1).scale(intensity));
}

function fixRotation() {
    rocket.body.angularVelocity.x = 0;
    rocket.body.angularVelocity.y = 0;
    rocket.body.velocity.z = 0;
}

function brake() {
    rocket.body.angularVelocity = new CANNON.Vec3(0, 0, 0);
    rocket.body.position.z = 0;
    rocket.body.velocity.z = 0;
}

function thrustEffect(enabled) {
    if (enabled) {
        rocketLight.intensity = rocketLightIntensity * 2.0;
        rocketLight.color.setHex(0xffff00);
        bottomCone.visible = true;
    } else {
        rocketLight.intensity = 0.0;
        rocketLight.color.setHex(0xffffff);
        bottomCone.visible = false;
    }
}

// ─── Fuel & state ─────────────────────────────────────────────────────────────

function addFuel(extraFuel) {
    fuel = Math.min(1, Math.max(0, fuel + extraFuel));
}

function restart() {
    rocket.body.position.copy(startPos);
    rocket.body.quaternion = new CANNON.Quaternion();
    rocket.body.velocity = new CANNON.Vec3(0, 0, 0);
    rocket.body.angularVelocity = new CANNON.Vec3(0, 0, 0);

    score = -3;
    fuel = 1;
    finished = false;
}

// ─── Collision ────────────────────────────────────────────────────────────────

function collision(e) {
    var relativeVelocity = e.contact.getImpactVelocityAlongNormal();

    if (e.body.physicalObject.name === 'bonus') {
        trashCan.push(e.body.physicalObject);
        addFuel(fuelPerBonus);
    } else if (Math.abs(relativeVelocity) > 100) {
        restart();
    } else if (e.body.physicalObject.name === 'satellite') {
        if ((score < bestscore || bestscore == null) && !finished) {
            finished = true;
            newHighscore(bestscore, score);
        }
        // Match satellite's orbital velocity so the rocket doesn't drift away
        stop(rocket.body);
        rocket.body.velocity.copy(satelliteVel);
    }
}

function newHighscore(prevBest, newBest) {
    uiHighscore.innerHTML = 'Best: ' + timetoText(newBest);
    bestscore = score;
}
