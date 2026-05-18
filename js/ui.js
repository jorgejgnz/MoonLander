// ─── dat.GUI panel ────────────────────────────────────────────────────────────

function initGui() {
    controller = {
        camRotation: 1,
        camDistance: 3,
        miniCam:     3,
        lights:      true,
        arrow:       true,
        trajectory:  true,
        arrowRef:    2,
        colliders:   false,
        stats:       true,
        controls:    true,
        restart: function () { restart(); }
    };

    var gui = new dat.GUI();

    var g1 = gui.addFolder('Camera');
    g1.add(controller, 'camRotation', { Interactive: 0, Gravity: 1, Ship: 2, Global: 3 }).name('Camera rotation');
    g1.add(controller, 'camDistance', { Ship: 0, Planet: 1, Satellite: 2, Auto: 3 }).name('Camera center');
    g1.add(controller, 'miniCam',     { Ship: 0, Planet: 1, Satellite: 2, Auto: 3 }).name('Thumbnail');

    var g2 = gui.addFolder('Ship');
    g2.add(controller, 'lights').name('Lights');
    g2.add(controller, 'arrow').name('Show velocity');
    g2.add(controller, 'trajectory').name('Show trajectory');
    g2.add(controller, 'arrowRef', { Planet: 0, Satellite: 1, Auto: 2 }).name('Velocity relative to');

    var g3 = gui.addFolder('Settings');
    g3.add(controller, 'colliders').name('Show colliders');
    g3.add(controller, 'stats').name('Show FPS');
    g3.add(controller, 'controls').name('Show controls');
    g3.add(controller, 'restart').name('Restart');
}

// ─── FPS stats widget ─────────────────────────────────────────────────────────

function initStats() {
    stats = new Stats();
    stats.setMode(0);
    document.getElementById('stats').appendChild(stats.domElement);
}

// ─── Per-frame updates ────────────────────────────────────────────────────────

function updateController(controller) {
    if (rocket != null) {
        arrowHelper.visible = controller.arrow;
        rocketLight.visible = controller.lights;
    }

    stats.domElement.style.display = controller.stats ? 'block' : 'none';
    colliderMat.opacity = controller.colliders ? 0.1 : 0.0;
}

function updateScore() {
    if (!finished) {
        score += deltaTime;
        uiScore.innerHTML = 't' + timetoText(score);
    }

    if (rocket != null) {
        var filled = Math.ceil(fuel * 10);
        var empty  = Math.floor((1 - fuel) * 10);

        var bar = '';
        for (var i = 0; i < filled; i++) bar += '█';
        for (var i = 0; i < empty;  i++) bar += '░';

        uiFuel.innerHTML = bar;
    }
}
