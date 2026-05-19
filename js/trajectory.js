// ─── Trajectory prediction ────────────────────────────────────────────────────
// Draws the ballistic path the rocket would follow for the next N seconds,
// assuming zero thrust. Updated every frame.
// A red impact marker is shown when the path intersects a celestial body.

var trajectoryLine   = null;
var trajectoryImpact = null; // red sphere shown at predicted collision point

var TRAJ_STEPS    = 300;  // sample points
var TRAJ_SUBSTEPS = 4;    // physics sub-steps per sample (accuracy vs. cost)
var TRAJ_DT       = 0.3;  // seconds per sample → 300 × 0.3 = 90 s total

function initTrajectory() {
    // ── Line ──────────────────────────────────────────────────────────────────
    var positions = new Float32Array(TRAJ_STEPS * 3);

    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));

    var material = new THREE.LineBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
    });

    trajectoryLine = new THREE.Line(geometry, material);
    // Disable frustum culling: bounding sphere is never auto-updated for
    // dynamic buffers, so Three.js would wrongly cull the line after the
    // rocket moves away from the origin.
    trajectoryLine.frustumCulled = false;
    scene.add(trajectoryLine);

    // ── Impact marker ─────────────────────────────────────────────────────────
    var impactGeo = new THREE.SphereGeometry(8, 8, 8);
    var impactMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
    trajectoryImpact = new THREE.Mesh(impactGeo, impactMat);
    trajectoryImpact.frustumCulled = false;
    trajectoryImpact.visible = false;
    scene.add(trajectoryImpact);
}

function updateTrajectory() {
    if (trajectoryLine == null) return;

    var show = rocket != null && controller.trajectory;
    trajectoryLine.visible   = show;
    trajectoryImpact.visible = false;
    if (!show) return;

    var positions = trajectoryLine.geometry.attributes.position.array;

    // Simulation state — plain scalars, zero allocations in the hot loop
    var px = rocket.body.position.x;
    var py = rocket.body.position.y;
    var pz = rocket.body.position.z;
    var vx = rocket.body.velocity.x;
    var vy = rocket.body.velocity.y;
    var vz = rocket.body.velocity.z;

    // Planet is fixed in world space (it only rotates visually)
    var plx = planet.body.position.x;
    var ply = planet.body.position.y;
    var plz = planet.body.position.z;

    // Orbit parameters for future satellite position
    // world_sat = (sysX, sysY) + rotate_z(angle) * (0, satelliteDistance)
    var orbitAngle = orbitCenter.rotation.z;
    var sysX = 0;
    var sysY = -planetRadius;

    var plR2  = planetRadius            * planetRadius;
    var satR2 = satelliteColliderRadius * satelliteColliderRadius;
    var subDt = TRAJ_DT / TRAJ_SUBSTEPS;
    var validPoints = 0;

    for (var i = 0; i < TRAJ_STEPS; i++) {
        // ── Collision check at current simulated position ──────────────────
        var futureAngleCheck = orbitAngle - satelliteSpeed * i * TRAJ_DT;
        var satXCheck = sysX - satelliteDistance * Math.sin(futureAngleCheck);
        var satYCheck = sysY + satelliteDistance * Math.cos(futureAngleCheck);

        var dplx = px - plx, dply = py - ply, dplz = pz - plz;
        var distToPlanetSq = dplx*dplx + dply*dply + dplz*dplz;

        var dsx = px - satXCheck, dsy = py - satYCheck, dsz = pz;
        var distToSatSq = dsx*dsx + dsy*dsy + dsz*dsz;

        if (distToPlanetSq < plR2 || distToSatSq < satR2) {
            // Only show the impact marker if the collision point is far enough
            // from the rocket — avoids a spurious marker when the rocket is
            // already sitting on or very close to a surface (100 unit threshold).
            var impactDx = px - rocket.body.position.x;
            var impactDy = py - rocket.body.position.y;
            var impactDz = pz - rocket.body.position.z;
            var impactDistSq = impactDx*impactDx + impactDy*impactDy + impactDz*impactDz;
            if (impactDistSq > 100 * 100) {
                trajectoryImpact.position.set(px, py, pz);
                trajectoryImpact.visible = true;
            }
            break;
        }

        // ── Record valid point ─────────────────────────────────────────────
        positions[i * 3]     = px;
        positions[i * 3 + 1] = py;
        positions[i * 3 + 2] = pz;
        validPoints++;

        // ── Advance simulation (TRAJ_SUBSTEPS sub-steps of subDt) ─────────
        for (var s = 0; s < TRAJ_SUBSTEPS; s++) {
            var futureAngle = orbitAngle - satelliteSpeed * (i * TRAJ_DT + s * subDt);
            var satX = sysX - satelliteDistance * Math.sin(futureAngle);
            var satY = sysY + satelliteDistance * Math.cos(futureAngle);

            // Planet gravity
            var tpx = plx - px, tpy = ply - py, tpz = plz - pz;
            var dp  = Math.sqrt(tpx*tpx + tpy*tpy + tpz*tpz);
            var aP  = (GRAVITY * planetMass) / (dp * dp);
            if (aP < gravityThreshold) aP = 0;

            // Satellite gravity
            var tsx = satX - px, tsy = satY - py, tsz = -pz;
            var ds  = Math.sqrt(tsx*tsx + tsy*tsy + tsz*tsz);
            var aS  = (GRAVITY * satelliteMass) / (ds * ds);
            if (aS < gravityThreshold) aS = 0;

            var ax = (tpx/dp)*aP + (tsx/ds)*aS;
            var ay = (tpy/dp)*aP + (tsy/ds)*aS;
            var az = (tpz/dp)*aP + (tsz/ds)*aS;

            // Symplectic Euler
            vx += ax * subDt;
            vy += ay * subDt;
            vz += az * subDt;
            px += vx * subDt;
            py += vy * subDt;
            pz += vz * subDt;
        }
    }

    trajectoryLine.geometry.setDrawRange(0, validPoints);
    trajectoryLine.geometry.attributes.position.needsUpdate = true;
}
