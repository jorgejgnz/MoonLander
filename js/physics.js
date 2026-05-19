// ─── Constructors ─────────────────────────────────────────────────────────────

function Cube(name, sizeX, sizeY, sizeZ, position, physMat, visMat, mass) {
    this.body = new CANNON.Body({ mass: mass, material: physMat });
    this.body.addShape(new CANNON.Box(new CANNON.Vec3(sizeX / 2, sizeY / 2, sizeZ / 2)));
    this.body.position.copy(position);
    this.body.linearDamping = 0;
    this.body.angularDamping = 0;

    this.visual = new THREE.Mesh(new THREE.CubeGeometry(sizeX, sizeY, sizeZ), visMat);
    this.visual.position.copy(this.body.position);

    this.gravityDir = new CANNON.Vec3(0, 0, 0);
    this.enabled = true;

    this.body.physicalObject = this;
    this.visual.physicalObject = this;
    this.name = name;

    world.addBody(this.body);
    scene.add(this.visual);
    physicalObjects.push(this);
}

function Cylinder(name, radiusTop, radiusBottom, height, numSegments, position, physMat, visMat, mass) {
    this.body = new CANNON.Body({ mass: mass, material: physMat });
    this.body.addShape(new CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments));
    this.body.position.copy(position);
    this.body.linearDamping = 0;
    this.body.angularDamping = 0;

    this.visual = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, numSegments, height), visMat);
    this.visual.position.copy(this.body.position);

    this.gravityDir = new CANNON.Vec3(0, 0, 0);
    this.enabled = true;

    this.body.physicalObject = this;
    this.visual.physicalObject = this;
    this.name = name;

    world.addBody(this.body);
    scene.add(this.visual);
    physicalObjects.push(this);
}

function Sphere(name, radius, position, physMat, visMat, mass) {
    this.body = new CANNON.Body({ mass: mass, material: physMat });
    this.body.addShape(new CANNON.Sphere(radius));
    this.body.position.copy(position);
    this.body.linearDamping = 0;
    this.body.angularDamping = 0;

    this.visual = new THREE.Mesh(new THREE.SphereGeometry(radius), visMat);
    this.visual.position.copy(this.body.position);

    this.gravityDir = new CANNON.Vec3(0, 0, 0);
    this.enabled = true;

    this.body.physicalObject = this;
    this.visual.physicalObject = this;
    this.name = name;

    world.addBody(this.body);
    scene.add(this.visual);
    physicalObjects.push(this);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, 0, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 20;

    physMat = new CANNON.Material('physMat');

    // In Cannon.js, friction/restitution between two bodies are taken from the
    // ContactMaterial that pairs their materials, NOT from the Material itself.
    // Without this, contacts fall back to defaults (≈0.3 friction, ≈0.3 restitution),
    // which is why the rocket was bouncing and sliding on the lunar surface.
    var physContact = new CANNON.ContactMaterial(physMat, physMat, {
        friction: 0.9,
        restitution: 0.0,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e8,
        frictionEquationRelaxation: 3
    });
    world.addContactMaterial(physContact);
    world.defaultContactMaterial.friction = 0.9;
    world.defaultContactMaterial.restitution = 0.0;
}

// ─── Per-frame updates ────────────────────────────────────────────────────────

function updateGravity(physicalObject) {
    // Static bodies (mass = 0) are driven by the scene graph, not by forces
    if (physicalObject.body.mass <= 0) return;

    var toPlanet    = planet.body.position.vsub(physicalObject.body.position);
    var toSatellite = satellite.body.position.vsub(physicalObject.body.position);
    var distToPlanet    = toPlanet.length();
    var distToSatellite = toSatellite.length();

    // Gravitational acceleration magnitudes (m/s²)
    var aPlanet    = (GRAVITY * planetMass)    / Math.pow(distToPlanet,    2);
    var aSatellite = (GRAVITY * satelliteMass) / Math.pow(distToSatellite, 2);
    if (aPlanet    < gravityThreshold) aPlanet    = 0.0;
    if (aSatellite < gravityThreshold) aSatellite = 0.0;

    // Acceleration vectors
    toPlanet.normalize();
    toSatellite.normalize();
    var accPlanet    = toPlanet.scale(aPlanet);
    var accSatellite = toSatellite.scale(aSatellite);
    var totalAcc     = accPlanet.vadd(accSatellite);

    // Apply as force (F = m·a) so Cannon.js constraint solver can balance it
    // with the contact normal force — prevents endless bouncing at rest on a surface
    var mass = physicalObject.body.mass;
    physicalObject.body.applyForce(
        new CANNON.Vec3(totalAcc.x * mass, totalAcc.y * mass, totalAcc.z * mass),
        physicalObject.body.position
    );

    // Store acceleration direction for camera orientation
    physicalObject.gravityLength = totalAcc.length();
    physicalObject.gravityDir.copy(totalAcc);
    physicalObject.gravityDir.normalize();
}

function matchPhysicalObject(physicalObject) {
    if (physicalObject.body.type === CANNON.Body.KINEMATIC) {
        // Position was already integrated by world.step() from the velocity
        // set in updateKinematicVelocity(); no teleport needed (and teleporting
        // would re-introduce the penetration kick we're trying to avoid).
        return;
    }
    if (physicalObject.body.mass > 0) {
        physicalObject.visual.position.copy(physicalObject.body.position);
        physicalObject.visual.quaternion.copy(physicalObject.body.quaternion);
    } else {
        var visualPos = new THREE.Vector3();
        var visualRot = new THREE.Quaternion();
        physicalObject.visual.getWorldPosition(visualPos);
        physicalObject.visual.getWorldQuaternion(visualRot);
        physicalObject.body.position.copy(visualPos);
        physicalObject.body.quaternion.copy(visualRot);
    }
}

// Compute the velocity a kinematic body needs in order to follow its scene-graph
// driven visual during the next world.step(). Must be called BEFORE world.step.
function updateKinematicVelocity(physicalObject) {
    if (physicalObject.body.type !== CANNON.Body.KINEMATIC) return;
    if (deltaTime <= 0) return;

    var visualPos = new THREE.Vector3();
    physicalObject.visual.getWorldPosition(visualPos);

    physicalObject.body.velocity.set(
        (visualPos.x - physicalObject.body.position.x) / deltaTime,
        (visualPos.y - physicalObject.body.position.y) / deltaTime,
        (visualPos.z - physicalObject.body.position.z) / deltaTime
    );
}

// ─── Body utilities ───────────────────────────────────────────────────────────

function orbit(body, bigMass, distToBigCenter) {
    var orbitSpeed = Math.sqrt((GRAVITY * bigMass) / distToBigCenter);
    body.velocity = new CANNON.Vec3(orbitSpeed, 0, 0);
}

function clampVelocity(body, maxSpeed) {
    if (body.velocity.length() > maxSpeed) {
        body.velocity.normalize();
        body.velocity = body.velocity.scale(maxSpeed);
    }
}

function stop(body) {
    body.velocity = new CANNON.Vec3(0, 0, 0);
    body.angularVelocity = new CANNON.Vec3(0, 0, 0);
}

function cleanTrashCan() {
    for (var i = 0; i < trashCan.length; i++) {
        world.removeBody(trashCan[i].body);
        trashCan[i].visual.visible = false;
        trashCan[i].enabled = false;
    }
    trashCan = [];
}
