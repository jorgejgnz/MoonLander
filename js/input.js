// ─── Init ─────────────────────────────────────────────────────────────────────

function initInput() {
    keyboard = new THREEx.KeyboardState();

    keyboard.domElement.addEventListener('keydown', function (event) {
        if (keyboard.eventMatches(event, 'a') || keyboard.eventMatches(event, 'left'))  onLeftPress();
        if (keyboard.eventMatches(event, 'd') || keyboard.eventMatches(event, 'right')) onRightPress();
        if (keyboard.eventMatches(event, 'space'))                                       onThrustPress();
        if (keyboard.eventMatches(event, 'down'))                                        brake();
    });

    keyboard.domElement.addEventListener('keyup', function (event) {
        if (keyboard.eventMatches(event, 'a') || keyboard.eventMatches(event, 'left'))  onLeftRelease();
        if (keyboard.eventMatches(event, 'd') || keyboard.eventMatches(event, 'right')) onRightRelease();
        if (keyboard.eventMatches(event, 'space'))                                       onThrustRelease();
    });

    // On-screen buttons (mobile)
    uiRotateL.addEventListener('pointerdown', onLeftPress);
    uiRotateL.addEventListener('pointerup',   onLeftRelease);
    uiRotateR.addEventListener('pointerdown', onRightPress);
    uiRotateR.addEventListener('pointerup',   onRightRelease);
    uiThrust.addEventListener('pointerdown',  onThrustPress);
    uiThrust.addEventListener('pointerup',    onThrustRelease);

    // Touch tracking (to cancel held inputs when finger lifts)
    window.addEventListener('touchstart', function () { window.USER_IS_TOUCHING = true; });
    window.addEventListener('touchend',   function () { window.USER_IS_TOUCHING = false; });
}

// ─── Action handlers ──────────────────────────────────────────────────────────

function onLeftPress()     { wantsRotateL = true; }
function onLeftRelease()   { wantsRotateL = false; rotatedL = false; }

function onRightPress()    { wantsRotateR = true; }
function onRightRelease()  { wantsRotateR = false; rotatedR = false; }

function onThrustPress()   { thrusting = true; }
function onThrustRelease() { thrusting = false; }
