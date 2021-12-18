var container, renderer, scene;

// Scene objects
var physicalObjects = [];
var planet, satellite, rocket;
var system, orbitCenter;
var rocketModel;
var sun, ambientLight;
var centralObject;

// Materials
var defaultMat;
var collectableMat;
var colliderMat;
var atmosphereMat;

// Animation
var clock = new THREE.Clock();
var prevDate = Date.now();
var deltatime = 0;
var gameTime = 0;

// Cameras
var camera, minicam;
var ar;
var miniSide = 200;
var wasUsingOrbitControls = false;

/*
var minCameraDist = 100;
var maxCameraDist = 1000;
var maxZoom = 1000;
var minZoom = 25;
var minSpeed = 10;
var maxSpeed = 1000;
var miniCamDist = 100;
var miniCamPlanetZoom = 10000;
var miniCamSatelliteZoom = 1000;
*/

var minCameraDist = 100;
var maxCameraDist = 10000;

var maxZoom = 1000;
var minZoom = 25;
var minSpeed = 10;
var maxSpeed = 1000;

var miniCamDist = 100;
var miniCamPlanetZoom = 10000;
var miniCamSatelliteZoom = 5000;

// Interaction
var cameraControls;
var stats;
var keyboard;
var controller;

// Physics
const G = 6.674e-1;
var world;
var physMat;
var velocityLerp, distanceLerp;
var gravityThreshold = 1.0;
var trashCan = []
var prevSatellitePos;
var satelliteVel;
var satelliteVelLength;

// System
/*
var planetRadius = 100;
var satelliteRadius = 20;
var satelliteDistance = 500.0;
var satelliteSpeed = Math.PI * 0.01;
var planetSpeed = 0.05;
var planetMass = 1e6;
var satelliteMass = 1e5;
*/

var planetRadius = 500;
var satelliteRadius = 200;
var satelliteDistance = 2500.0;
var satelliteSpeed = Math.PI * 0.005;
var planetSpeed = 0.005;
var planetMass = 2.5e7;
var satelliteMass = 2.5e6;

/*
var planetRadius = 1000;
var satelliteRadius = 200;
var satelliteDistance = 5000.0;
var satelliteSpeed = Math.PI * 0.006;
var planetSpeed = 0.005;
var planetMass = 5e7;
var satelliteMass = 5e6;
*/

// Bonus
var numBonus = 10;
var bonusRadius = 10;
var distBetweenOrbits = 350;
var fuelPerBonus = 0.1; // 0 to 1

// Rocket
//var startPos = new CANNON.Vec3(0,20,0);
var startPos = new CANNON.Vec3(0,20,0);
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

// Style
var assets, rocketAsset, planetAsset, satelliteAsset, starAsset;
var textureLoader, cubeTextureLoader, cubeTexture;
var skyboxLayer = 1;

// UI
var finished = false;
var score = -3;
var bestscore = null;
var uiScore, uiHighscore;
var uiFuel;
var uiControls;

// Constructors

function Cube( name, sizeX, sizeY, sizeZ, position, physMat, visMat, mass )
{
    this.body = new CANNON.Body( {mass: mass, material: physMat} );
	this.body.addShape( new CANNON.Box( new CANNON.Vec3(sizeX/2, sizeY/2, sizeZ/2) ) );
	this.body.position.copy( position );
    this.body.linearDamping = 0;
    this.body.angularDamping = 0;

	this.visual = new THREE.Mesh( new THREE.CubeGeometry( sizeX, sizeY, sizeZ ), visMat );
	this.visual.position.copy( this.body.position );

    this.gravityDir = new CANNON.Vec3(0,0,0);
    this.enabled = true;

    this.body.physicalObject = this;
    this.visual.physicalObject = this;

    this.name = name;

    world.addBody(this.body);
    scene.add(this.visual);

    physicalObjects.push(this);
}

function Cylinder( name, radiusTop, radiusBottom, height, numSegments, position, physMat, visMat, mass )
{
	this.body = new CANNON.Body( {mass: mass, material: physMat} );
	this.body.addShape( new CANNON.Cylinder( radiusTop, radiusBottom, height, numSegments ) );
	this.body.position.copy( position );
    this.body.linearDamping = 0;
    this.body.angularDamping = 0;

	this.visual = new THREE.Mesh( new THREE.CylinderGeometry( radiusTop, radiusBottom, height, numSegments, height ), visMat );
	this.visual.position.copy( this.body.position );

    this.gravityDir = new CANNON.Vec3(0,0,0);
    this.enabled = true;

    this.body.physicalObject = this;
    this.visual.physicalObject = this;

    this.name = name;

    world.addBody(this.body);
    scene.add(this.visual);

    physicalObjects.push(this);
}

function Sphere( name, radius, position, physMat, visMat, mass )
{
	this.body = new CANNON.Body( {mass: mass, material: physMat} );
	this.body.addShape( new CANNON.Sphere( radius ) );
	this.body.position.copy( position );
    this.body.linearDamping = 0;
    this.body.angularDamping = 0;

	this.visual = new THREE.Mesh( new THREE.SphereGeometry( radius ), visMat );
	this.visual.position.copy( this.body.position );

    this.gravityDir = new CANNON.Vec3(0,0,0);
    this.enabled = true;

    this.body.physicalObject = this;
    this.visual.physicalObject = this;

    this.name = name;

    world.addBody(this.body);
    scene.add(this.visual);

    physicalObjects.push(this);
}

// Main

function init()
{
    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer();
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.setClearColor( new THREE.Color(0x000000), 1.0);
    renderer.autoClear = false;

    container = document.getElementById("container");
    container.appendChild(renderer.domElement);

    ar = window.innerWidth / window.innerHeight;

    textureLoader = new THREE.TextureLoader();
    
    initCameras();
    initInput();
    initPhysics();
    initScene();
    initGui();
    initStats();

    // Resize detection
    window.addEventListener('resize', updateAspectRatio);
    window.addEventListener('wheel', onMouseWheel);

    // Get UI elements
    uiScore = document.getElementById("uiScore");
    uiHighscore = document.getElementById("uiHighscore");
    uiFuel = document.getElementById("uiFuel");
    uiControls = document.getElementById("uiControls");
}

function update()
{
    deltaTime = (Date.now() - prevDate)/1000;
    gameTime += deltaTime;

    // System
    orbitCenter.rotation.z -= satelliteSpeed * deltaTime;
    planet.visual.rotation.z -= planetSpeed * deltaTime;

    // Satellite velocity
    if (rocket != null)
    {
        satelliteVel = satellite.body.position.vsub(prevSatellitePos);
        satelliteVelLength = satelliteVel.length() / deltaTime;
        satelliteVel.normalize();
        satelliteVel.scale(satelliteVelLength);
        prevSatellitePos.copy(satellite.body.position);
    }

    // Physics
    cleanTrashCan();
    world.step(deltaTime);
    for (let i = 0; i < physicalObjects.length; i++) {
        if (physicalObjects[i].enabled)
        {
            updateGravity(physicalObjects[i]);
            matchPhysicalObject(physicalObjects[i]);
        }
    }

    // Rocket
    if (rocket != null)
    {
        updateRocket();
        updateScore();
    }

    // GUI
    updateController(controller);

    // Central object
    if (rocket != null)
    {
        let planetPos = planet.body.position;
        let satellitePos = satellite.body.position;
        let rocketPos = rocket.body.position

        if (planetPos.vsub(rocketPos).length() < satellitePos.vsub(rocketPos).length()) centralObject = planet;
        else centralObject = satellite;
    }
    else centralObject = planet;

    // Camera
    updateCamera();
    updateMiniCam();

    // Stats
    stats.update();

    // Controls
    if (controller.controls) uiControls.style.visibility = "visible";
    else uiControls.style.visibility = "hidden";

    prevDate = Date.now();
}

function render()
{
    requestAnimationFrame(render);
    update();

    renderer.clear();

    // Perspectiva interactiva
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.render(scene,camera);

    // Mini
    renderer.setViewport(0, 0, miniSide, miniSide);
    renderer.setScissor(0, 0, miniSide, miniSide);
    renderer.setScissorTest(true);
    renderer.clear();
    renderer.setScissorTest(false);
    renderer.render(scene,minicam);
}

// Inits

function initScene()
{
	// Material init
    defaultMat = new THREE.MeshPhongMaterial({color:0xFFAAAA});
    colliderMat = new THREE.MeshLambertMaterial({color:0xFFFFFF,opacity:0.1,transparent:true});
    collectableMat = new THREE.MeshBasicMaterial({color:0x00FF00,});
    
	// Axis
    scene.add(new THREE.AxisHelper(5));

    // Lighting
    sun = new THREE.DirectionalLight( 0xffffff, 1.0 );
    sun.position.set(0,0,1);
    scene.add(sun);

    ambientLight = new THREE.HemisphereLight( 0xaaaaff, 0x0000ff, 0.5 );
    ambientLight.position.set(0,1,0);
    scene.add(ambientLight);

    // Environment
    cubeTextureLoader = new THREE.CubeTextureLoader();
    cubeTextureLoader.setPath('images/skybox/');

    cubeTexture = cubeTextureLoader.load([
        'posx.png', 'negx.png',
        'posy.png', 'negy.png',
        'posz.png', 'negz.png'
    ]);

    setupEnvironment(cubeTexture,20000,skyboxLayer);

    // System
    planet = new Sphere( "planet", planetRadius, new CANNON.Vec3( 0, 0, 0 ), physMat, colliderMat, 0.0 );
    satellite = new Sphere( "satellite", satelliteRadius, new CANNON.Vec3( 0, satelliteDistance, 0 ), physMat, colliderMat, 0.0 );

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

    // Rocket
    importModelFromGltf('models/rocket/assets.glb','assets',(gltf) => {
        assets = gltf.scene;

        // Setup rocket
        rocketAsset = assets.getObjectByName("rocket");
        setupRocket(rocketAsset);

        // Setup planet
        planetAsset = assets.getObjectByName("planet");
        setupPlanet(planetAsset);

        // Setup satellite
        satelliteAsset = assets.getObjectByName("satellite");
        setupSatellite(satelliteAsset);

        // Setup bonus
        for (let i = 0; i < numBonus; i++) {
            setupBonus(bonusRadius, 0.05, (i+1) * distBetweenOrbits);
        }
    });
}

function initGui()
{
    controller = {
        camRotation: 1,
        camDistance: 3,
        miniCam: 3,
        lights: true,
        arrow: true,
        arrowRef: 2,
        colliders: false,
        stats: true,
        controls: true,
        restart:()=>{restart()},
    }

    // Creacion interfaz
    var gui = new dat.GUI();
    
    // Construcción del menu
    var g1 = gui.addFolder("Camera");
    g1.add(controller, "camRotation", {Interactive: 0, Gravity: 1, Ship: 2, Global: 3}).name("Camera rotation");
    g1.add(controller, "camDistance", {Ship: 0, Planet: 1, Satellite: 2, Auto: 3}).name("Camera center");
    g1.add(controller, "miniCam", {Ship: 0, Planet: 1, Satellite: 2, Auto: 3}).name("Thumbnail");

    var g2 = gui.addFolder("Ship");
    g2.add(controller, "lights").name("Lights");
    g2.add(controller, "arrow").name("Show velocity");
    g2.add(controller, "arrowRef", {Planet: 0, Satellite: 1, Auto: 2}).name("Velocity relative to");

    var g3 = gui.addFolder("Settings");
    g3.add(controller, "colliders").name("Show colliders");
    g3.add(controller, "stats").name("Show FPS");
    g3.add(controller, "controls").name("Show controls");
    g3.add(controller,'restart').name('Restart');
}

function initCameras(ar) // ar: aspect ratio
{
    // Main camera
    camera = new THREE.PerspectiveCamera(60, ar, 0.1, 10000000);
    camera.position.set(-30,20,30);
    camera.lookAt(0,0,0);

    camera.layers.enable( skyboxLayer );

    cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
    cameraControls.target.set(0,1,0);
    cameraControls.enableKeys = false;
    cameraControls.update();

    scene.add(camera);

    updateAspectRatio();

    // Mini cam
    updateMiniSide();

    minicam = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.1, 10000000);

    minicam.position.set(0,0,miniCamDist);
    minicam.lookAt(0,0,0);

    scene.add(minicam);
}

function initInput()
{
    // Keyboard
    keyboard = new THREEx.KeyboardState();

    keyboard.domElement.addEventListener('keydown', function(event){
        if (keyboard.eventMatches(event, 'a') || keyboard.eventMatches(event, 'left'))
        {
            wantsRotateL=true;
        }
        if (keyboard.eventMatches(event, 'd') || keyboard.eventMatches(event, 'right'))
        {
            wantsRotateR=true;
        }      
        if (keyboard.eventMatches(event, 'space'))
        {
            thrusting = true;
        }
        if (keyboard.eventMatches(event, 'down'))
        {
            brake();
        }
    })

    keyboard.domElement.addEventListener('keyup', function(event){
        if (keyboard.eventMatches(event, 'a') || keyboard.eventMatches(event, 'left'))
        {
            wantsRotateL = false;
            rotatedL = false;
        }
        if (keyboard.eventMatches(event, 'd') || keyboard.eventMatches(event, 'right'))
        {
            wantsRotateR = false;
            rotatedR = false;
        }
        if (keyboard.eventMatches(event, 'space'))
        {
            thrusting = false;
        }
    })
}

function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0,0,0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;

    physMat = new CANNON.Material({
        name:'physMat',
        friction:0.9,
        restitution:0.3
    });
}

function initStats()
{
    stats = new Stats();
    stats.setMode(0);
    document.getElementById("stats").appendChild(stats.domElement);
}

// Updates

function updateRocket()
{
    fixRotation();

    let newSpeed = rocket.body.velocity.length();
    if (newSpeed - rocket.prevSpeed > 10) stop(rocket.body);
    rocket.prevSpeed = newSpeed;

    clampVelocity(rocket.body, maxRocketSpeed);

    // Velocty arrow
    let dir = new CANNON.Vec3(0,0,0);
    dir.copy(rocket.body.velocity);

    if (controller.arrowRef == 0)
    {
        // Planet is static
    }
    else if (controller.arrowRef == 1)
    {
        dir.vsub(satelliteVel);
    }
    else if (controller.arrowRef == 2)
    {
        if (centralObject == satellite) dir.vsub(satelliteVel);
        else {} // Planet is static
    }

    let length = 10.0 + dir.length(); // Before normalization

    dir.normalize();
    arrowHelper.setDirection(dir);
    arrowHelper.setLength(length);
    arrowHelper.position.copy(rocket.visual.position);

    // Thrust
    if (wantsRotateL && !rotatedL)
    {
        leftCone.visible = true;
        rotate(torqueIntensity);
        rotatedL = true;
    }
    else if (!wantsRotateL || rotatedL)
    {
        leftCone.visible = false;
    }

    if (wantsRotateR && !rotatedR)
    {
        rightCone.visible = true;
        rotate(-torqueIntensity);
        rotatedR = true;
    }
    else if (!wantsRotateR || rotatedR)
    {
        rightCone.visible = false;
    }

    if (thrusting)
    {
        thrust(thrustIntensity);

        rocketLight.intensity = rocketLightIntensity * 2.0;
        rocketLight.color.setHex( 0xffff00 );

        bottomCone.visible = true;
    }
    else
    {
        rocketLight.intensity = rocketLightIntensity;
        rocketLight.color.setHex( 0xffffff );

        bottomCone.visible = false;
    }

    rocket.body.mass = rocketDryMass + fuel * rocketFuelMass;
}

function updateGravity(physicalObject)
{
    let toPlanet = planet.body.position.vsub(physicalObject.body.position);
    let toSatellite = satellite.body.position.vsub(physicalObject.body.position);
    let distToPlanet = toPlanet.length();
    let distToSatellite = toSatellite.length();

    let planetGravity = (G*planetMass)/Math.pow(distToPlanet,2);
    if (planetGravity < gravityThreshold) planetGravity = 0.0;

    let satelliteGravity = (G*satelliteMass)/Math.pow(distToSatellite,2);
    if (satelliteGravity < gravityThreshold) satelliteGravity = 0.0;

    let planetImpulse = toPlanet;
    planetImpulse.normalize();
    planetImpulse = planetImpulse.scale(planetGravity);

    let satelliteImpulse = toSatellite;
    satelliteImpulse.normalize();
    satelliteImpulse = satelliteImpulse.scale(satelliteGravity);

    let totalImpulse = planetImpulse.vadd(satelliteImpulse);

    physicalObject.body.velocity = physicalObject.body.velocity.vadd(totalImpulse.scale(deltaTime));

    physicalObject.gravityLength = totalImpulse.length();

    physicalObject.gravityDir.copy(totalImpulse);
    physicalObject.gravityDir.normalize();
}

function updateCamera()
{   
    if (rocket != null)
    {
        velocityLerp = lerp(minSpeed, maxSpeed, rocket.body.velocity.length());

        let destination, radius;
        if (controller.camDistance == 1)
        {
            destination = planet.body.position;
            radius = planetRadius;
            distanceLerp = lerp(radius, 10 * radius, destination.vsub(rocket.body.position).length());
        }
        else if (controller.camDistance == 2)
        {
            destination = satellite.body.position;
            radius = satelliteRadius;
            distanceLerp = lerp(radius, 10 * radius, destination.vsub(rocket.body.position).length());
        }
         else if (controller.camDistance == 3)
        {
            destination = centralObject.body.position;
            if (centralObject == planet) radius = planetRadius;
            else radius = satelliteRadius;

            distanceLerp = lerp(radius, 10 * radius, destination.vsub(rocket.body.position).length());
        }  
        else
        {
            distanceLerp = 0.05;
        }
    }

    if (rocket == null || controller.camRotation == 0)
    {
        cameraControls.enabled = true;
        cameraControls.update();

        let pos = new THREE.Vector3();
        if (controller.camDistance == 1)
        {
            planet.visual.getWorldPosition(pos);
        }
        else if (controller.camDistance == 2)
        {
            satellite.visual.getWorldPosition(pos);
        }
        else if (rocket != null)
        {
            if (controller.camDistance == 3) centralObject.visual.getWorldPosition(pos);
            else rocket.visual.getWorldPosition(pos);
        }

        cameraControls.target.set( pos.x, pos.y, pos.z );

        if (!wasUsingOrbitControls)
        {
            cameraControls.reset();
            camera.up = new THREE.Vector3(0,1,0);
            wasUsingOrbitControls = true;
        }
    }
    else
    {
        cameraControls.enabled = false;

        let cameraDist = inverseLerp(minCameraDist, maxCameraDist, distanceLerp);

        camera.position.x = rocket.body.position.x;
        camera.position.y = rocket.body.position.y;
        camera.position.z = cameraDist;
        camera.lookAt(rocket.visual.position);

        let grav = rocket.gravityDir;

        if (controller.camRotation == 1)
        {
            camera.up = new THREE.Vector3(-grav.x,-grav.y,-grav.z);
        }
        else if (controller.camRotation == 2)
        {
            let yDir = new THREE.Vector3(0,1,0).applyQuaternion(rocket.visual.quaternion);
            camera.up = new THREE.Vector3(yDir.x,yDir.y,yDir.z);
        }
        else if (controller.camRotation == 3)
        {
            camera.up = new THREE.Vector3(0,1,0);
        }

        if (wasUsingOrbitControls) wasUsingOrbitControls = false;
    }
}

function updateMiniCam()
{
    if (rocket != null)
    {
        let zoom = 0;
        let worldPos = new THREE.Vector3();

        if (controller.miniCam == 0)
        {
            rocket.visual.getWorldPosition(worldPos);
            zoom = inverseLerp(minZoom, maxZoom, velocityLerp);
        }
        else if (controller.miniCam == 1) // Planet
        {
            planet.visual.getWorldPosition(worldPos);
            zoom = miniCamPlanetZoom;
        }
        else if (controller.miniCam == 2) // Satellite
        {
            satellite.visual.getWorldPosition(worldPos);
            zoom = miniCamSatelliteZoom;
        }
        else if (controller.miniCam == 3) // Auto
        {
            if (distanceLerp < 0.1)
            {
                if (centralObject == satellite)
                {
                    satellite.visual.getWorldPosition(worldPos);
                    zoom = miniCamSatelliteZoom;
                }
                else
                {
                    planet.visual.getWorldPosition(worldPos);
                    zoom = miniCamPlanetZoom;
                }
            }
            else
            {
                rocket.visual.getWorldPosition(worldPos);
                zoom = inverseLerp(minZoom, maxZoom, velocityLerp);
            }
        }

        minicam.position.x = worldPos.x;
        minicam.position.y = worldPos.y;

        minicam.left = -zoom;
        minicam.right = zoom;
        minicam.top = zoom;
        minicam.bottom = -zoom;

        minicam.updateProjectionMatrix();
    }
}

function  updateController(controller)
{
    if (rocket != null)
    {
        arrowHelper.visible = controller.arrow;
        rocketLight.visible = controller.lights;
    }

    if (controller.stats) stats.domElement.style.display = 'block';
    else stats.domElement.style.display = 'none';

    if (controller.colliders) colliderMat.opacity = 0.1;
    else colliderMat.opacity = 0.0;
}

function updateScore()
{
    if(!finished)
    {
        score += deltaTime;
        uiScore.innerHTML = 't' + timetoText(score);
    }

    if(rocket != null)
    {
        let filled = Math.ceil(fuel * 10);
        let empty = Math.floor((1 - fuel) * 10);

        let bar = "";
        for (let i = 0; i < filled; i++) {
            bar += "█";
        }
        for (let i = 0; i < empty; i++) {
            bar += "░";
        }

        uiFuel.innerHTML = bar;
    }
}

// Setups

function setupRocket(rocketAsset)
{
    rocketAsset.position.y = -7.0;
    rocketAsset.rotation.y = -Math.PI * 0.7;
    rocketAsset.scale.x = 4;
    rocketAsset.scale.y = 4;
    rocketAsset.scale.z = 4;

    rocket = new Cube( "rocket", 15.0, 40.0, 15.0, new CANNON.Vec3(0,0,0).copy(startPos), physMat, colliderMat, rocketDryMass + rocketFuelMass );
    rocket.visual.add(rocketAsset);

    bottomCone = new THREE.Mesh( new THREE.ConeGeometry( 5, 30, 8 ), new THREE.MeshBasicMaterial( {
        color: 0xffffff,
        transparent: true,
        opacity: 0.5
    } ));
    bottomCone.position.y = -20;
    bottomCone.visible = false;
    rocket.visual.add(bottomCone);

    leftCone = new THREE.Mesh( new THREE.ConeGeometry( 2, 10, 8 ), new THREE.MeshBasicMaterial( {
        color: 0xffffff,
        //transparent: true,
        //opacity: 0.5
    } ));
    leftCone.position.x = 10;
    leftCone.position.y = 15;
    leftCone.rotation.z = Math.PI/2;  
    leftCone.visible = false;  
    rocket.visual.add(leftCone);

    rightCone = new THREE.Mesh( new THREE.ConeGeometry( 2, 10, 8 ), new THREE.MeshBasicMaterial( {
        color: 0xffffff,
        //transparent: true,
        //opacity: 0.5
    } ));
    rightCone.position.x = -10;
    rightCone.position.y = 15;
    rightCone.rotation.z = -Math.PI/2;
    rightCone.visible = false;
    rocket.visual.add(rightCone);

    arrowHelper = new THREE.ArrowHelper( new THREE.Vector3( 0,-1,0 ), new THREE.Vector3( 0,0,0 ), 30.0, 0xffff00 );
    scene.add( arrowHelper );

    rocketLight = new THREE.PointLight( 0xffffff, rocketLightIntensity, 40.0 );
    rocketLight.position.y = -15;
    rocket.visual.add(rocketLight);

    rocket.prevSpeed = 0;

    rocket.body.addEventListener("collide",collision);
}

function setupPlanet(planetAsset)
{
    planetAsset.position = new THREE.Vector3(0,0,0);
    planetAsset.scale.x = planetAsset.scale.y = planetAsset.scale.z = planetRadius * 1.025;

    loadTexturedMaterial('models/rocket/','atmos-alpha.png',1,1,(mat) => {
        let atmosphereAsset = planetAsset.getObjectByName("atmosphere");

        atmosphereMat = new THREE.MeshBasicMaterial({color:0x87ceeb});
        atmosphereMat.map = mat.map;
        atmosphereMat.alphaMap = mat.map;
        atmosphereMat.transparent = true;

        atmosphereAsset.material = atmosphereMat;
    })

    planet.visual.add(planetAsset);
}

function setupSatellite(satelliteAsset)
{
    satelliteAsset.position = new THREE.Vector3(0,0,0);
    satelliteAsset.scale.x = satelliteAsset.scale.y = satelliteAsset.scale.z = satelliteRadius * 0.97;

    satellite.visual.add(satelliteAsset);

    prevSatellitePos = new CANNON.Vec3(satelliteAsset.position.x,satelliteAsset.position.y,satelliteAsset.position.z);
}

function setupBonus(radius, mass, distToSurface)
{
    let bonus = new Sphere( "bonus", radius, planet.body.position.vadd( new CANNON.Vec3( 0, planetRadius + distToSurface, 0 ) ), physMat, collectableMat, mass );
    orbit(bonus.body, planetMass, planetRadius + distToSurface);
};

// Cameras

function updateAspectRatio()
{
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Aspect ratio pantalla
    ar = window.innerWidth/window.innerHeight;
    camera.aspect = ar;

    camera.updateProjectionMatrix();

    // Update mini-side
    updateMiniSide();
}

function updateMiniSide()
{
    miniSide = window.innerHeight / 2.0;
    if (window.innerWidth < window.innerHeight) miniSide = window.innerWidth / 2.0;
}

// Physics

function matchPhysicalObject(physicalObject)
{
    if (physicalObject.body.mass > 0)
    {
        physicalObject.visual.position.copy( physicalObject.body.position );
        physicalObject.visual.quaternion.copy( physicalObject.body.quaternion );
    }
    else
    {
        let visualPos = new THREE.Vector3();
        let visualRot = new THREE.Quaternion();
        physicalObject.visual.getWorldPosition(visualPos);
        physicalObject.visual.getWorldQuaternion(visualRot);
        physicalObject.body.position.copy(visualPos);
        physicalObject.body.quaternion.copy(visualRot);
    }
}

// Rocket control

function thrust(intensity)
{
    if (fuel > 0)
    {
        thrusting=true;
        rocket.body.applyLocalForce(new CANNON.Vec3(0,1,0).scale(intensity), new CANNON.Vec3(0,0,0));
        addFuel(-fuelPerPulse);
    }
}

function rotate(intensity)
{
    rocket.body.torque = rocket.body.torque.vadd(new CANNON.Vec3(0,0,1).scale(intensity));
}

function fixRotation()
{
    rocket.body.angularVelocity.x = 0;
    rocket.body.angularVelocity.y = 0;

    rocket.body.velocity.z = 0;
}

function brake()
{
    rocket.body.angularVelocity = new CANNON.Vec3(0,0,0);
    rocket.body.position.z = 0;
    rocket.body.velocity.z = 0;
}

function restart()
{
    rocket.body.position.copy(startPos);
    rocket.body.quaternion = new CANNON.Quaternion();

    rocket.body.velocity = new CANNON.Vec3(0,0,0);
    rocket.body.angularVelocity = new CANNON.Vec3(0,0,0);

    score = -3;
    fuel = 1;
    finished = false;
}

function addFuel(extraFuel)
{
    fuel += extraFuel;
    if (fuel < 0) fuel = 0;
    else if (fuel > 1) fuel = 1;
}

function collision(e)
{
    var relativeVelocity = e.contact.getImpactVelocityAlongNormal();
    if (e.body.physicalObject.name == "bonus")
    {
        trashCan.push(e.body.physicalObject);
        addFuel(fuelPerBonus);
    }
    else if(Math.abs(relativeVelocity) > 100)
    {
        restart();
    }
    else if(e.body.physicalObject.name == "satellite")
    {
        if (( score < bestscore || bestscore == null ) && !finished)
        {
            finished = true;
            newHighscore(bestscore, score);
        }
    }
}

function newHighscore(prevBest, newBest)
{
    uiHighscore.innerHTML = "Best: " + timetoText(newBest);
    bestscore = score;
}

// Utils

function importModelFromGltf(path, name, action)
{
	var loader = new THREE.GLTFLoader();
	// Load a glTF resource
	loader.load(path,
		// called when the resource is loaded
		function (gltf) {
			/*
			gltf.animations; // Array<THREE.AnimationClip>
			gltf.scene; // THREE.Group
			gltf.scenes; // Array<THREE.Group>
			gltf.cameras; // Array<THREE.Camera>
			gltf.asset; // Object
			*/
			gltf.name=name;

			action(gltf);
		},
        function ( xhr ) {
			console.log( ( xhr.loaded / xhr.total * 100 ).toFixed(2) + '% loaded' );
		}
	);
}

function lerp(min, max, value)
{
    let l = (value-min)/(max-min);
    return Math.min(Math.max(l, 0.0), 1.0);
}

function inverseLerp(min, max, lerp)
{
    return min + (max-min) * lerp;
}

function timetoText(totalSeconds)
{
    let absTime = Math.abs(Math.floor(totalSeconds));
    let hours = Math.floor(absTime/3600);
    absTime = absTime - hours * 3600;
    let minutes = Math.floor(absTime/60);
    let seconds = absTime - minutes * 60;

    let t_text = str_pad_left(hours,'0',2) + ':' + str_pad_left(minutes,'0',2) + ':' + str_pad_left(seconds,'0',2);
    if (totalSeconds < 0) t_text = '-' + t_text;
    else  t_text = '+' + t_text;

    return t_text;
}

function str_pad_left(string,pad,length) {
    return (new Array(length+1).join(pad)+string).slice(-length);
}

function loadTexturedMaterial(path, filename, repeatX, repeatY, onDone)
{
    textureLoader.load(
        path+filename,
        (textureMap) =>
        {
            textureMap.magfilter = THREE.LinearFilter;
            textureMap.minfilter = THREE.LinearFilter;
            textureMap.repeat.set(repeatX,repeatY);
            textureMap.wrapS = textureMap.wrapT = THREE.MirroredRepeatWrapping;

            let mat = new THREE.MeshPhongMaterial({
                color:'white',
                map: textureMap
            });

            onDone(mat);
        });
}

function setupEnvironment(cubeTexture, cubeSize, layer)
{
    var sahder = THREE.ShaderLib.cube;
    sahder.uniforms.tCube.value = cubeTexture;

    var wallsMaterials = new THREE.ShaderMaterial({
        fragmentShader: sahder.fragmentShader,
        vertexShader: sahder.vertexShader,
        uniforms: sahder.uniforms,
        depthWrite: false,
        side: THREE.BackSide
    });

    var room = new THREE.Mesh(new THREE.CubeGeometry(cubeSize,cubeSize,cubeSize), wallsMaterials);
    room.layers.set(layer); // Only visible for that layer
    scene.add(room);
}

function orbit(body, bigMass, distToBigCenter)
{
    let orbitSpeed = Math.sqrt((G*bigMass)/distToBigCenter);
    body.velocity = new CANNON.Vec3(orbitSpeed,0,0);
}

function clampVelocity(body, maxSpeed)
{
    if (body.velocity.length() > maxSpeed)
    {
        body.velocity.normalize();
        body.velocity = body.velocity.scale(maxSpeed);
    }
}

function stop(body)
{
    body.velocity = new CANNON.Vec3(0,0,0);
    body.angularVelocity = new CANNON.Vec3(0,0,0);
}

function cleanTrashCan()
{
    for (let i = 0; i < trashCan.length; i++) {
        world.removeBody(trashCan[i].body);
        trashCan[i].visual.visible = false;
        trashCan[i].enabled = false;
    }
}

// Input

function onMouseWheel( event )
{
    if (rocket != null)
    {
        if(event.deltaY > 1){
            maxCameraDist += 1000;
        } else {
            if (maxCameraDist > 0) maxCameraDist -= 1000;
        }
        console.log(maxCameraDist);
    }
}

window.onload = () => {
    init();
    render();    
}