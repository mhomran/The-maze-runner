import { Scene } from '../common/game';
import ShaderProgram from '../common/shader-program';
import Mesh from '../common/mesh';
import * as MeshUtils from '../common/mesh-utils';
import Camera from '../common/camera';
import FlyCameraController from '../common/camera-controllers/fly-camera-controller';
import { vec3, mat4 } from 'gl-matrix';
import { createElement } from 'tsx-create-element';
import { Vector, Selector } from '../common/dom-utils';

interface Level {
    coin: vec3[],
    health:vec3[],
    beast:vec3[]
};

// This function creates a triangle wave, this is used to move the house model
function triangle(x: number): number {
    let i = Math.floor(x);
    return (i % 2 == 0) ? (x - i) : (1 + i - x);
}

// In this scene we will draw a small scene with multiple textured models and we will explore Anisotropic filtering
export default class TexturedModelsScene extends Scene {
    programs: { [name: string]: ShaderProgram } = {};
    cameras: Camera[];
    controller: FlyCameraController;
    meshes: { [name: string]: Mesh } = {};
    health_postions: vec3[];
    coin_postions: vec3[];
    beast_postions: vec3[];
    health_count : number = 10;
    coin_count: number = 0;
    textures: { [name: string]: WebGLTexture } = {};

    objectPosition: vec3 = vec3.fromValues(-2.6, -1.5, -10);

    Levels: {[name:string]:Level};

    time: number = 0;
  

    anisotropy_ext: EXT_texture_filter_anisotropic; // This will hold the anisotropic filtering extension
    anisotropic_filtering: number = 0; // This will hold the maximum number of samples that the anisotropic filtering is allowed to read. 1 is equivalent to isotropic filtering.

    public load(): void {
        this.game.loader.load({
            ["texture.vert"]: { url: 'shaders/texture.vert', type: 'text' },
            ["texture.frag"]: { url: 'shaders/texture.frag', type: 'text' },
            ["color.vert"]: { url: 'shaders/color.vert', type: 'text' },
            ["color.frag"]: { url: 'shaders/color.frag', type: 'text' },

            //#maze
            ["maze-model"]: { url: 'models/maze/maze.obj', type: 'text' },
            ["maze-texture"]: { url: 'models/maze/maze.png', type: 'image' },

            //#health
            ["health-model"]: { url: 'models/health/health.obj', type: 'text' },
            ["health-texture"]: { url: 'models/health/health.png', type: 'image' },

            //#suzanne
            ["suzanne-model"]: { url: 'models/Suzanne/Suzanne.obj', type: 'text' },

            //#health
            ["coin-model"]: { url: 'models/coin/coin.obj', type: 'text' },
            ["coin-texture"]: { url: 'models/coin/coin.png', type: 'image' },

            //#beast
            ["beast-model"]: { url: 'models/beast/beast.obj', type: 'text' },
            ["beast-texture"]: { url: 'models/beast/beast.png', type: 'image' },
            
            //#key
            ["key-model"]: {url:'models/key/key.obj', type: 'text'},
            ["key-texture"]: {url:'models/key/key.png', type:'image'},

            //#levels
            ["Levels"]:{url: 'data/Levels.json', type:'json'}
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

        this.Levels = this.game.loader.resources["Levels"];

        this.meshes['ground'] = MeshUtils.Plane(this.gl, { min: [0, 0], max: [100, 100] });
        this.meshes['maze'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["maze-model"]);
        this.meshes['health'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["health-model"]);
        this.meshes['suzanne'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["suzanne-model"]);
        this.meshes['coin'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["coin-model"]);
        this.meshes['ground'] = MeshUtils.Plane(this.gl, { min: [0, 0], max: [100, 100] });
        this.meshes['beast'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["beast-model"]);
        this.meshes['key'] = MeshUtils.LoadOBJMesh(this.gl, this.game.loader.resources["key-model"]);

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
        let data = Array(W * H * 3);
        for (let j = 0; j < H; j++) {
            for (let i = 0; i < W; i++) {
                data[i + j * W] = (Math.floor(i / cW) + Math.floor(j / cH)) % 2 == 0 ? C0 : C1;
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

        //beast texture
        this.textures['beast-texture'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['beast-texture']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['beast-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        //key texture
        this.textures['key-texture'] = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['key-texture']);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 4);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.game.loader.resources['key-texture']);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);

        // Anisotropic filtering is not supported by WebGL by default so we need to ask the context for the extension.
        this.anisotropy_ext = this.gl.getExtension('EXT_texture_filter_anisotropic');
        // The device does not support anisotropic fltering, the extension will be null. So we need to check before using it.
        // if it is supported, we will set our default filtering samples to the maximum value allowed by the device.
        if (this.anisotropy_ext) this.anisotropic_filtering = this.gl.getParameter(this.anisotropy_ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);

        this.cameras = [];
        this.cameras[0] = new Camera();
        this.cameras[0].type = 'perspective';
        this.cameras[0].position = vec3.fromValues(0, 2, 0);
        this.cameras[0].direction = vec3.fromValues(-1, 0, -2);
        this.cameras[0].aspectRatio = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;

        this.controller = new FlyCameraController(this.cameras[0], this.game.input);
        this.controller.movementSensitivity = 0.01;

        this.cameras[1] = new Camera();
        this.cameras[1].type = 'orthographic';
        this.cameras[1].position = vec3.fromValues(0, 30, 0);
        this.cameras[1].direction = vec3.fromValues(0, -1, 0);
        this.cameras[1].up = vec3.fromValues(1, 0, 0);
        this.cameras[1].orthographicHeight = 60;
        this.cameras[1].aspectRatio = 1;

        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        this.gl.frontFace(this.gl.CCW);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);

        this.gl.clearColor(0.88, 0.65, 0.15, 1);

       // this.setupControls();

    }

    public Collision() {
        this.objectPosition = vec3.fromValues(this.cameras[0].position[0] + (this.cameras[0].direction[0] * 2),
        -1,
        this.cameras[0].position[2] + this.cameras[0].direction[2] * 2)

        //check for collision with the maze borders
        if (this.cameras[0].position[0] > 31)
        {
            this.cameras[0].position[0] = 31;
        }
        else if (this.cameras[0].position[0] < -31)
        {
            this.cameras[0].position[0] = -31;
        }

        if (this.cameras[0].position[2] > 31)
        {
            this.cameras[0].position[2] = 31;
        }
        else if (this.cameras[0].position[2] < -31)
        {
            this.cameras[0].position[2] = -31;
        }
        
        //collision with health
        for (let i = 0; i < this.Levels.Level1.health.length; i++) {

            if (Math.ceil(this.Levels.Level1.health[i][0]) == Math.ceil(this.objectPosition[0])
                && Math.ceil(this.Levels.Level1.health[i][2]) == Math.ceil(this.objectPosition[2])) {
                this.health_count++;
                document.querySelector('#Health_p').innerHTML =
                    this.health_count.toFixed();
                    this.Levels.Level1.health.splice(i, 1);
            }
        }

        //collision with coins
        for (let i = 0; i < this.Levels.Level1.coin.length; i++) {

            if (Math.ceil(this.Levels.Level1.coin[i][0]) == Math.ceil(this.objectPosition[0])
                && Math.ceil(this.Levels.Level1.coin[i][2]) == Math.ceil(this.objectPosition[2])) {
                this.coin_count++;
                document.querySelector('#Score_p').innerHTML =
                    this.coin_count.toFixed();
                    this.Levels.Level1.coin.splice(i, 1);
            }
        }

        
        //collision with beasts
        for (let i = 0; i < this.Levels.Level1.beast.length; i++) {

            if (Math.ceil(this.Levels.Level1.beast[i][0] + (5 * triangle(this.time / 1000))) == Math.ceil(this.objectPosition[0])
                && Math.ceil(this.Levels.Level1.beast[i][2]) == Math.ceil(this.objectPosition[2])) {
                this.health_count--;
              
                document.querySelector('#Health_p').innerHTML =
                    this.health_count.toFixed();
            }
        }
        let x = this.GAME_CHECK();
        if (x==1||x==3)
        alert('Game over');
        else if (x==2)
        alert('ala wadak');
       

    }

    public GAME_CHECK():number{

        
        if(this.health_count==0)
        {
            return 1;
        }

      if (Math.ceil(this.objectPosition[0])==30 &&Math.ceil(this.objectPosition[2])==31){
          return 2;
      }
      if( document.querySelector('#Timer_p').innerHTML=="Finished")
      {
        document.querySelector('#Timer_p').innerHTML=="Finished";
        return 3;
      }

      return 0;
    }

    public draw(deltaTime: number): void {
        this.controller.update(deltaTime);

        console.log(this.cameras[0].position);

        this.time += deltaTime; // Update time

        this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        this.gl.scissor(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        //prevent camer to go in y
        this.cameras[0].position[1] = 1;

        this.drawScene(this.cameras[0].ViewProjectionMatrix);

        // This will enable the scissor test (now we can restrict WebGL to never modify pixels outside a specific rectangle in the screen)
        this.gl.enable(this.gl.SCISSOR_TEST);

        this.gl.viewport(0, this.gl.drawingBufferHeight - 200, 200, 200);
        this.gl.scissor(0, this.gl.drawingBufferHeight - 200, 200, 200);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        this.drawScene(this.cameras[1].ViewProjectionMatrix); // Draw the scene from the Top camera

        this.Collision();
    }

    private drawScene(VP: mat4) {
        this.programs['texture'].use();

        //draw health        
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['health-texture']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);

        for (let i = 0; i < this.Levels.Level1.health.length; i++) {
            let healthMat = mat4.clone(VP);     
            mat4.translate(healthMat, healthMat, this.Levels.Level1.health[i]);
            mat4.rotateX(healthMat, healthMat, Math.PI);
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

        for (let i = 0; i < this.Levels.Level1.coin.length; i++) {
            let coinMat = mat4.clone(VP);
            mat4.translate(coinMat, coinMat, this.Levels.Level1.coin[i]);
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
        this.programs['texture'].setUniform4f("tint", [1, 0, 0, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['ground']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);
        // If anisotropic filtering is supported, we send the parameter to the texture paramters.
        if (this.anisotropy_ext) this.gl.texParameterf(this.gl.TEXTURE_2D, this.anisotropy_ext.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic_filtering);

        this.meshes['ground'].draw(this.gl.TRIANGLES);

        //draw key
        let keyMat = mat4.clone(VP);
        mat4.translate(keyMat, keyMat, [29.7, -.5, 31]);
        mat4.rotateY(keyMat, keyMat, Math.PI / 4 + Math.PI);
        mat4.scale(keyMat,keyMat, [20, 20, 20]);

        this.programs['texture'].setUniformMatrix4fv("MVP", false, keyMat);
        this.programs['texture'].setUniform4f("tint", [1, 1, 1, 1]);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['key-texture']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);
        // If anisotropic filtering is supported, we send the parameter to the texture paramters.
        if (this.anisotropy_ext) this.gl.texParameterf(this.gl.TEXTURE_2D, this.anisotropy_ext.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic_filtering);

        this.meshes['key'].draw(this.gl.TRIANGLES);
        
        //draw beasts
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures['beast-texture']);
        this.programs['texture'].setUniform1i('texture_sampler', 0);

        for (let i = 0; i < this.Levels.Level1.beast.length; i++) {
            let beastMat = mat4.clone(VP);
            mat4.translate(beastMat, beastMat, this.Levels.Level1.beast[i]);
            mat4.translate(beastMat, beastMat, [5 * triangle(this.time / 1000), 0, 0]);

            this.programs['texture'].setUniformMatrix4fv("MVP", false, beastMat);
            this.programs['texture'].setUniform4f("tint", [1, 1, 1, 1]);

            this.meshes['beast'].draw(this.gl.TRIANGLES);
        }

        //draw Suzanne
        this.programs['color'].use();

        let suMat = mat4.clone(VP);

        mat4.translate(suMat, suMat, this.objectPosition);

        if (this.cameras[0].direction[2] < 0) {
            mat4.rotateY(suMat, suMat, Math.PI + Math.atan(this.cameras[0].direction[0] /
                this.cameras[0].direction[2]));
        }
        else {
            mat4.rotateY(suMat, suMat, Math.atan(this.cameras[0].direction[0] /
                this.cameras[0].direction[2]));
        }

        this.programs['color'].setUniformMatrix4fv("MVP", false, suMat);
        this.programs['color'].setUniform4f("tint", [0, 1, 1, 1]);

        this.meshes['suzanne'].draw(this.gl.TRIANGLES);
    }

    public end(): void {
        for (let key in this.programs)
            this.programs[key].dispose();
        this.programs = {};
        for (let key in this.meshes)
            this.meshes[key].dispose();
        this.meshes = {};
        for (let key in this.textures)
            this.gl.deleteTexture(this.textures[key]);
        this.textures = {};
       
    }




}
//