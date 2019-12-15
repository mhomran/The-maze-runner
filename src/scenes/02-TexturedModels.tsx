import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4 } from 'gl-matrix';
import { createElement} from 'tsx-create-element';

// In this scene we will draw a small scene with multiple textured models and we will explore Anisotropic filtering
export default class TexturedModelsScene extends Scene {
    programs : {[name: string]: ShaderProgram} = {};
    camera: Camera;
    controller: FlyCameraController;
    meshes: {[name: string]: Mesh} = {};
    textures: {[name: string]: WebGLTexture} = {};

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
            ["suzanne-model"]:{url:'models/Suzanne/Suzanne.obj', type:'text'}
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
    }
    
    public draw(deltaTime: number): void {
        this.controller.update(deltaTime);

        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        this.programs['texture'].use();

        let VP = this.camera.ViewProjectionMatrix;

        //draw health
        let healthMat = mat4.clone(VP);
        mat4.translate(healthMat, healthMat, [-20, 5, -10]);
        mat4.scale(healthMat, healthMat, [20, 20, 20]);

        this.programs['texture'].setUniformMatrix4fv("MVP", false, healthMat);
        this.programs['texture'].setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['health-texture']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);

        this.meshes['health'].draw(this.gl.TRIANGLES);

        //draw maze
        let mazeMat = mat4.clone(VP);
        mat4.scale(mazeMat, mazeMat, [.5, .5, .5]);

        this.programs['texture'].setUniformMatrix4fv("MVP", false, mazeMat);
        this.programs['texture'].setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['maze-texture']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);

        this.meshes['maze'].draw(this.gl.TRIANGLES);
    
        this.programs['color'].use();

        //draw Suzanne
        let suMat = mat4.clone(VP);
        mat4.translate(suMat, suMat, [8, 0, 0]);

        this.programs['color'].setUniformMatrix4fv("MVP", false, suMat);
        this.programs['color'].setUniform4f("tint", [.5, .5, .5, 1]);

        this.meshes['suzanne'].draw(this.gl.TRIANGLES);
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
        
        

        controls.appendChild(
            <div>
                {!!this.anisotropy_ext?
                    <div className="control-row">
                        <label className="control-label">Anisotropic Filtering</label>
                        <input type="number" value={this.anisotropic_filtering} onchange={(ev: InputEvent)=>{this.anisotropic_filtering=Number.parseFloat((ev.target as HTMLInputElement).value)}}/>
                        <label className="conrol-label">Max: {this.gl.getParameter(this.anisotropy_ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}</label>
                    </div>
                    :
                    <div className="control-row">
                        <label className="control-label">Anisotropic Filtering is not supported on this device.</label>
                    </div>
                }
            </div>
            
        );
        
    }

    private clearControls() {
        const controls = document.querySelector('#controls');
        controls.innerHTML = "";
    }


}