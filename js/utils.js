// ─── Math helpers ─────────────────────────────────────────────────────────────

function lerp(min, max, value) {
    var l = (value - min) / (max - min);
    return Math.min(Math.max(l, 0.0), 1.0);
}

function inverseLerp(min, max, t) {
    return min + (max - min) * t;
}

// ─── Time / text ──────────────────────────────────────────────────────────────

function timetoText(totalSeconds) {
    var absTime = Math.abs(Math.floor(totalSeconds));
    var hours = Math.floor(absTime / 3600);
    absTime = absTime - hours * 3600;
    var minutes = Math.floor(absTime / 60);
    var seconds = absTime - minutes * 60;

    var t_text = str_pad_left(hours, '0', 2) + ':' +
                 str_pad_left(minutes, '0', 2) + ':' +
                 str_pad_left(seconds, '0', 2);

    return (totalSeconds < 0 ? '-' : '+') + t_text;
}

function str_pad_left(string, pad, length) {
    return (new Array(length + 1).join(pad) + string).slice(-length);
}

// ─── Asset loading ────────────────────────────────────────────────────────────

function importModelFromGltf(path, name, action) {
    var loader = new THREE.GLTFLoader();
    loader.load(
        path,
        function (gltf) {
            gltf.name = name;
            action(gltf);
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100).toFixed(2) + '% loaded');
        }
    );
}

function loadTexturedMaterial(path, filename, repeatX, repeatY, onDone) {
    textureLoader.load(
        path + filename,
        function (textureMap) {
            textureMap.magfilter = THREE.LinearFilter;
            textureMap.minfilter = THREE.LinearFilter;
            textureMap.repeat.set(repeatX, repeatY);
            textureMap.wrapS = textureMap.wrapT = THREE.MirroredRepeatWrapping;

            var mat = new THREE.MeshPhongMaterial({ color: 'white', map: textureMap });
            onDone(mat);
        }
    );
}

// ─── Environment ──────────────────────────────────────────────────────────────

function setupEnvironment(cubeTexture, cubeSize, layer) {
    var shader = THREE.ShaderLib.cube;
    shader.uniforms.tCube.value = cubeTexture;

    var wallsMaterials = new THREE.ShaderMaterial({
        fragmentShader: shader.fragmentShader,
        vertexShader: shader.vertexShader,
        uniforms: shader.uniforms,
        depthWrite: false,
        side: THREE.BackSide
    });

    var room = new THREE.Mesh(new THREE.CubeGeometry(cubeSize, cubeSize, cubeSize), wallsMaterials);
    room.layers.set(layer);
    scene.add(room);
}
