import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4} from 'gl-matrix';
import { createElement} from 'tsx-create-element';
import { Vector, Selector } from '../common/dom-utils';

// In this scene we will draw a small scene with multiple textured models and we will explore Anisotropic filtering
export default class TexturedModelsScene extends Scene {
    programs : {[name: string]: ShaderProgram} = {};
    camera: Camera;
    controller: FlyCameraController;
    meshes: {[name: string]: Mesh} = {};
    health_postions: vec3[];
    coin_postions: vec3[];
    health_count:number=5;
    textures: {[name: string]: WebGLTexture} = {};

    objectPosition: vec3 = vec3.fromValues(-2.6, -1.5, -10);

    anisotropy_ext: EXT_texture_filter_anisotropic; // This will hold the anisotropic filtering extension
    anisotropic_filtering: number = 0; // This will hold the maximum number of samples that the anisotropic filtering is allowed to read. 1 is equivalent to isotropic filtering.

    public load(): void {
        this.game.loader.load({
            ["texture.vert"]:{url:'shaders/texture.vert', type:'text'},
            ["texture.frag"]:{url:'shaders/texture.frag', type:'text'},
            ["color.vert"]:{url:'shaders/color.vert', type:'text'},
            ["color.frag"]:{url:'shaders/color.frag', type:'text'},
            
            //#maze
            ["maze-model"]:{url:'models/maze/maze.obj', type:'text'},
            ["maze-texture"]:{url:'models/maze/maze.png', type:'image'},
    
            //#health
            ["health-model"]:{url:'models/health/health.obj', type:'text'},
            ["health-texture"]:{url:'models/health/health.png', type:'image'},

            //#suzanne
            ["suzanne-model"]:{url:'models/Suzanne/Suzanne.obj', type:'text'},

            //#health
            ["coin-model"]:{url:'models/coin/coin.obj', type:'text'},
            ["coin-texture"]:{url:'models/coin/coin.png', type:'image'}
            });
    } 
    
    public start(): void {
        this.programs['texture'] = new ShaderProgram(this.gl);
        this.programs['texture'].attach(this.game.loader.resources["texture.vert"], this.gl.VERTEX_SHADER);
        this.programs['texture'].attach(this.game.loader.resources["texture.frag"], this.gl.FRAGMENT_SHADER);
        this.programs['texture'].link();

        this.programs['color'] = new ShaderProgram(this.gl);
        this.programs['color'].attach(this.game.loader.resources["color.vert"], this.gl.VERTEX_SHADER);
        this.programs['color'].attach(this.game.loader.resources["color.frag"], this.gl.FRAGMENT_SHADER);
        this.programs['color'].link();

        this.meshes['ground'] = MeshUtils.Plane(this.gl, {min:[0,0], max:[100,100]});
        this.meshes['maze'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["maze-model"]);
        this.meshes['health'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["health-model"]);
        this.meshes['suzanne'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["suzanne-model"]);
        this.meshes['coin'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["coin-model"]);
        this.meshes['ground'] = MeshUtils.Plane(this.gl, {min:[0,0], max:[100,100]});

        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
        
        //health texture
        this.textures['health-texture'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['health-texture']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['health-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
        
        //ground texture
        this.textures['ground'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
        const C0 = [26, 23, 15], C1 = [245, 232, 163];
        const W = 1024, H = 1024, cW = 256, cH = 256;
        let data = Array(W*H*3);
        for(let j = 0; j < H; j++){
            for(let i = 0; i < W; i++){
                data[i + j*W] = (Math.floor(i/cW) + Math.floor(j/cH))%2 == 0 ? C0 : C1;
            }
        }
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, W, H, 0, this.gl.RGB, this.gl.UNSIGNED_BYTE, new Uint8Array(data.flat()));
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
        
        //maze texture
        //#pop
        this.textures['maze-texture'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['maze-texture']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['maze-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        //coin texture
        this.textures['coin-texture'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['coin-texture']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['coin-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        
        // Anisotropic filtering is not supported by WebGL by default so we need to ask the context for the extension.
        this.anisotropy_ext = this.gl.getExtension('EXT_texture_filter_anisotropic');
        // The device does not support anisotropic fltering, the extension will be null. So we need to check before using it.
        // if it is supported, we will set our default filtering samples to the maximum value allowed by the device.
        if(this.anisotropy_ext) this.anisotropic_filtering = this.gl.getParameter(this.anisotropy_ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);

        this.camera = new Camera();
        this.camera.type = 'perspective';
        this.camera.position = vec3.fromValues(0,2,0);
        this.camera.direction = vec3.fromValues(-1,0,-2);
        this.camera.aspectRatio = this.gl.drawingBufferWidth/this.gl.drawingBufferHeight;
        
        this.controller = new FlyCameraController(this.camera, this.game.input);
        this.controller.movementSensitivity = 0.01;

        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        this.gl.clearColor(0.88,0.65,0.15,1);

        this.setupControls();

        //put the health
        this.health_postions = [
            vec3.fromValues(-2, -1.5, -10),
            vec3.fromValues(29, -1.5, 2),
            vec3.fromValues(-10, -1.5, -25),
            vec3.fromValues(23, -1.5, 8),
            vec3.fromValues(-29, -1.5, -29)
        ];

        //put the coin
        this.coin_postions = [
            vec3.fromValues(-28, -1.5, 29),
            vec3.fromValues(2.5, -1.5, 25),
            vec3.fromValues(-14, -1.5, 24),
            vec3.fromValues(-23, -1.5, -16),
            vec3.fromValues(-19, -1.5, -29)
        ];    
    }
    
    public Collision()
    {

        this.objectPosition = vec3.fromValues(this.camera.position[0] + (this.camera.direction[0] * 2),
        -1 + this.camera.direction[1] * 2,
        this.camera.position[2] + this.camera.direction[2] * 2) 
    
        for (let i =0 ;i< this.health_postions.length ; i++){
            console.log(this.health_postions[i]);
            if(Math.ceil(this.health_postions[i][0]) == Math.ceil(this.objectPosition[0])
            && Math.ceil(this.health_postions[i][2]) == Math.ceil(this.objectPosition[2]))
            {
                console.log("hereeeeeeeee");
                this.health_postions.splice(i,1);
            }
        }

        for (let i =0 ;i< this.coin_postions.length ; i++){
            console.log(this.coin_postions[i]);
            if(Math.ceil(this.coin_postions[i][0]) == Math.ceil(this.objectPosition[0])
            && Math.ceil(this.coin_postions[i][2]) == Math.ceil(this.objectPosition[2]))
            {
                this.coin_postions.splice(i,1);
            }
        }
    }

    public draw(deltaTime: number): void {
        this.controller.update(deltaTime);

        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        this.programs['texture'].use();

        this.camera.position[1] = 1;

        let VP = this.camera.ViewProjectionMatrix;

        //console.log(this.camera.position);
        
        //draw health        
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['health-texture']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);

        for(let i = 0; i < this.health_postions.length; i++){
        let healthMat = mat4.clone(VP); 
        mat4.translate(healthMat, healthMat, this.health_postions[i]);
        mat4.scale(healthMat, healthMat, [10, 10, 10]);

        this.programs['texture'].setUniformMatrix4fv("MVP", false, healthMat);
        this.programs['texture'].setUniform4f("tint", [1, 1, 1, 1]);

        this.meshes['health'].draw(this.gl.TRIANGLES);
        }

        //draw maze
        let mazeMat = mat4.clone(VP);
        mat4.scale(mazeMat, mazeMat, [.5, .5, .5]);

        this.programs['texture'].setUniformMatrix4fv("MVP", false, mazeMat);
        this.programs['texture'].setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['maze-texture']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);

        this.meshes['maze'].draw(this.gl.TRIANGLES);
        
        
        //draw coin
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['coin-texture']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);

        for(let i = 0; i < this.coin_postions.length; i++){
            let coinMat = mat4.clone(VP); 
            mat4.translate(coinMat, coinMat, this.coin_postions[i]);
            mat4.scale(coinMat, coinMat, [5, 5, 5]);
    
            this.programs['texture'].setUniformMatrix4fv("MVP", false, coinMat);
            this.programs['texture'].setUniform4f("tint", [1, 1, 1, 1]);
    
            this.meshes['coin'].draw(this.gl.TRIANGLES);
        }

        //draw ground
        let groundMat = mat4.clone(VP);
        mat4.translate(groundMat, groundMat, [0, -2, 0]);
        mat4.scale(groundMat, groundMat, [100, 1, 100]);

        this.programs['texture'].setUniformMatrix4fv("MVP", false, groundMat);
        this.programs['texture'].setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);
        // If anisotropic filtering is supported, we send the parameter to the texture paramters.
        if(this.anisotropy_ext) this.gl.texParameterf(this.gl.TEXTURE_2D, this.anisotropy_ext.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic_filtering);

        this.meshes['ground'].draw(this.gl.TRIANGLES);

        //draw Suzanne
        this.programs['color'].use();

        let suMat = mat4.clone(VP);
        mat4.translate(suMat, suMat, vec3.fromValues(this.camera.direction[0] * 2, this.camera.direction[1] * 2, this.camera.direction[2] * 2));
        mat4.translate(suMat, suMat, vec3.fromValues(this.camera.position[0], - 1, this.camera.position[2]));
        
        this.programs['color'].setUniformMatrix4fv("MVP", false, suMat);
        this.programs['color'].setUniform4f("tint", [.5, .5, .5, 1]);

        this.meshes['suzanne'].draw(this.gl.TRIANGLES);
      this.Collision();        

    }
    
    public end(): void {
        for (let key in this.programs)
            this.programs[key].dispose();
        this.programs = {};
        for(let key in this.meshes)
            this.meshes[key].dispose();
        this.meshes = {};
        for(let key in this.textures)
            this.gl.deleteTexture(this.textures[key]);
        this.textures = {};
        this.clearControls();
    }


    /////////////////////////////////////////////////////////
    ////// ADD CONTROL TO THE WEBPAGE (NOT IMPORTNANT) //////
    /////////////////////////////////////////////////////////
    private setupControls() {
        const controls = document.querySelector('#controls');

        const RGBToHex = (rgb: [number, number, number]): string => {
            let arraybuffer = new ArrayBuffer(4);
            let dv = new DataView(arraybuffer);
            dv.setUint8(3, 0);
            dv.setUint8(2, rgb[0]);
            dv.setUint8(1, rgb[1]);
            dv.setUint8(0, rgb[2]);
            return '#' + dv.getUint32(0, true).toString(16);
        }

        const HexToRGB = (hex: string): [number, number, number] => {
            let arraybuffer = new ArrayBuffer(4);
            let dv = new DataView(arraybuffer);
            dv.setUint32(0, Number.parseInt(hex.slice(1), 16), true);
            return [dv.getUint8(2), dv.getUint8(1), dv.getUint8(0)];
        }
        
        controls.appendChild(
            <div>
                <div className="control-row">
                    <label className="control-label">Object Position</label>
                    <Vector vector={this.objectPosition}/>    
                </div>
            </div>
        );
    }

    private clearControls() {
        const controls = document.querySelector('#controls');
        controls.innerHTML = "";
    }
}