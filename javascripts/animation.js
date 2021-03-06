// *******************************************************
// CS 174a Graphics Example Code
// animation.js - The main file and program start point.  The class definition here describes how to display an Animation and how it will react to key and mouse input.  Right now it has 
// very little in it - you will fill it in with all your shape drawing calls and any extra key / mouse controls.  

// Now go down to display() to see where the sample shapes are drawn, and to see where to fill in your own code.

"use strict";
var canvas, canvas_size, gl = null, g_addrs,
    movement = vec2(), thrust = vec3(), looking = false, prev_time = 0, animate = false, animation_time = 0;
var gouraud = false, color_normals = false, solid = false;
function CURRENT_BASIS_IS_WORTH_SHOWING(self, model_transform) {
    self.m_axis.draw(self.basis_id++, self.graphicsState, model_transform, new Material(vec4(.8, .3, .8, 1), 1, 1, 1, 40, ""));
}


// *******************************************************	
// When the web page's window loads it creates an "Animation" object.  It registers itself as a displayable object to our other class "GL_Context" -- which OpenGL is told to call upon every time a
// draw / keyboard / mouse event happens.

window.onload = function init() {
    var anim = new Animation();
};

function Animation() {
    (function init(self) {
        self.context = new GL_Context("gl-canvas");
        self.context.register_display_object(self);

        gl.clearColor(0, 0, 0, 1);	// Background color

        self.m_cube = new cube();
        self.m_obj = new shape_from_file("teapot.obj");
        self.m_axis = new axis();
        self.m_sphere = new sphere(mat4(), 4);
        self.m_fan = new triangle_fan_full(10, mat4());
        self.m_strip = new rectangular_strip(1, mat4());
        self.m_cylinder = new cylindrical_strip(10, mat4());
        self.m_tetrahedron = new tetrahedron(mat4());
        self.m_pyramid = new pyramid(mat4());
        self.m_parallelogon = new parallelogon(mat4());

        // 1st parameter is camera matrix.  2nd parameter is the projection:  The matrix that determines how depth is treated.  It projects 3D points onto a plane.
        self.graphicsState = new GraphicsState(translate(0, 0, -40), perspective(45, canvas.width / canvas.height, .1, 1000), 0);

        gl.uniform1i(g_addrs.GOURAUD_loc, gouraud);
        gl.uniform1i(g_addrs.COLOR_NORMALS_loc, color_normals);
        gl.uniform1i(g_addrs.SOLID_loc, solid);

        self.context.render();
    })(this);

    canvas.addEventListener('mousemove', function (e) {
        e = e || window.event;
        movement = vec2(e.clientX - canvas.width / 2, e.clientY - canvas.height / 2, 0);
    });
}

// *******************************************************	
// init_keys():  Define any extra keyboard shortcuts here
Animation.prototype.init_keys = function () {
    shortcut.add("Space", function () {
        thrust[1] = -1;
    });
    shortcut.add("Space", function () {
        thrust[1] = 0;
    }, {'type': 'keyup'});
    shortcut.add("z", function () {
        thrust[1] = 1;
    });
    shortcut.add("z", function () {
        thrust[1] = 0;
    }, {'type': 'keyup'});
    shortcut.add("w", function () {
        thrust[2] = 1;
    });
    shortcut.add("w", function () {
        thrust[2] = 0;
    }, {'type': 'keyup'});
    shortcut.add("a", function () {
        thrust[0] = 1;
    });
    shortcut.add("a", function () {
        thrust[0] = 0;
    }, {'type': 'keyup'});
    shortcut.add("s", function () {
        thrust[2] = -1;
    });
    shortcut.add("s", function () {
        thrust[2] = 0;
    }, {'type': 'keyup'});
    shortcut.add("d", function () {
        thrust[0] = -1;
    });
    shortcut.add("d", function () {
        thrust[0] = 0;
    }, {'type': 'keyup'});
    shortcut.add("f", function () {
        looking = !looking;
    });
    shortcut.add(",", (function (self) {
        return function () {
            self.graphicsState.camera_transform = mult(rotate(3, 0, 0, 1), self.graphicsState.camera_transform);
        };
    })(this));
    shortcut.add(".", (function (self) {
        return function () {
            self.graphicsState.camera_transform = mult(rotate(3, 0, 0, -1), self.graphicsState.camera_transform);
        };
    })(this));

    shortcut.add("r", (function (self) {
        return function () {
            self.graphicsState.camera_transform = mat4();
        };
    })(this));
    shortcut.add("ALT+s", function () {
        solid = !solid;
        gl.uniform1i(g_addrs.SOLID_loc, solid);
        gl.uniform4fv(g_addrs.SOLID_COLOR_loc, vec4(Math.random(), Math.random(), Math.random(), 1));
    });
    shortcut.add("ALT+g", function () {
        gouraud = !gouraud;
        gl.uniform1i(g_addrs.GOURAUD_loc, gouraud);
    });
    shortcut.add("ALT+n", function () {
        color_normals = !color_normals;
        gl.uniform1i(g_addrs.COLOR_NORMALS_loc, color_normals);
    });
    shortcut.add("ALT+a", function () {
        animate = !animate;
    });

    shortcut.add("p", (function (self) {
        return function () {
            self.m_axis.basis_selection++;
            console.log("Selected Basis: " + self.m_axis.basis_selection);
        };
    })(this));
    shortcut.add("m", (function (self) {
        return function () {
            self.m_axis.basis_selection--;
            console.log("Selected Basis: " + self.m_axis.basis_selection);
        };
    })(this));
};

function update_camera(self, animation_delta_time) {
    var leeway = 70, border = 50;
    var degrees_per_frame = .0005 * animation_delta_time;
    var meters_per_frame = .03 * animation_delta_time;
    // Determine camera rotation movement first
    var movement_plus = [movement[0] + leeway, movement[1] + leeway];	// movement[] is mouse position relative to canvas center; leeway is a tolerance from the center.
    var movement_minus = [movement[0] - leeway, movement[1] - leeway];
    var outside_border = false;

    for (var i = 0; i < 2; i++)
        if (Math.abs(movement[i]) > canvas_size[i] / 2 - border)    outside_border = true;	// Stop steering if we're on the outer edge of the canvas.

    for (var i = 0; looking && outside_border == false && i < 2; i++)			// Steer according to "movement" vector, but don't start increasing until outside a leeway window from the center.
    {
        var velocity = ( ( movement_minus[i] > 0 && movement_minus[i] ) || ( movement_plus[i] < 0 && movement_plus[i] ) ) * degrees_per_frame;	// Use movement's quantity unless the &&'s zero it out
        self.graphicsState.camera_transform = mult(rotate(velocity, i, 1 - i, 0), self.graphicsState.camera_transform);			// On X step, rotate around Y axis, and vice versa.
    }
    self.graphicsState.camera_transform = mult(translate(scale_vec(meters_per_frame, thrust)), self.graphicsState.camera_transform);		// Now translation movement of camera, applied in local camera coordinate frame
}


/**
 * Called once per frame whenever OpenGL decides it's time to redraw.
 * @param time
 */
Animation.prototype.display = function (time) {
    if (!time) {
        time = 0;
    }

    this.animation_delta_time = time - prev_time;
    if (animate) {
        this.graphicsState.animation_time += this.animation_delta_time;
    }

    prev_time = time;

    update_camera(this, this.animation_delta_time);

    this.basis_id = 0;

    var model_transform = mat4();

    // Play scene
    // Instantiate objects
    this.ground(model_transform);

    var NUM_TANKS = 5;
    var TANK_VELOCITY = vec3(1, 0, 0);
    var INTERVAL = 10;

    var tanks = [];
    for (var i = 0; i < NUM_TANKS; i++) {
        // Add Delay
        var tankDelta = mat4;
        var tankPosition = mult(model_transform, translate(0, 0, 10*i));
        if (this.graphicsState.animation_time / 100 > (i * INTERVAL)) {
            tankDelta = translate(scale_vec(this.graphicsState.animation_time / 100 - i * INTERVAL, TANK_VELOCITY));
            tankPosition = mult(tankPosition, tankDelta);
        }

        var tankTurretRotation = periodicPivot(this.graphicsState.animation_time / 1000, 10, 60);

        // Draw tank
        tanks[i] = this.tank(tankPosition, tankTurretRotation);
    }

    // Update camera
    if (animate) {
        this.graphicsState.camera_transform = lookAt(vec3(50, 10, -50), getPos(tanks[1]), vec3(0, 1, 0));
    }
};

/**
 * Returns the 3D coordinate position of a given mat4.
 */
var getPos = function (model_transform) {
    return vec3(model_transform[0][3], model_transform[1][3], model_transform[1][3]);
};

/**
 * Generates a vec4 object from RGB values.
 * @param red RGB red value
 * @param green RGB green value
 * @param blue RGB blue value
 * @param alpha RGB alpha value
 * @returns {*} Get vec4 RGB object
 */
var getColorVec = function (red, green, blue, alpha) {
    return vec4(red / 255.0, green / 255.0, blue / 255.0, alpha / 255.0);
};

/**
 * Returns the degree rotation for a periodic pivot given a time.
 */
var periodicPivot = function (time, period, maxPivot) {
    var swaySpeed = period / 4 / maxPivot;

    var time = time % period;
    var degree = 0;
    if (time >= 0 && time < period / 4) {
        degree = (time - 0) / swaySpeed;
    } else if (time >= period / 4 && time < period / 2) {
        degree = (time - period / 4) / -swaySpeed + maxPivot;
    } else if (time >= period / 2 && time < period * 3 / 4) {
        degree = (time - period / 2) / -swaySpeed;
    } else {
        degree = (time - period * 3 / 4) / swaySpeed - maxPivot;
    }

    console.log(degree);
    return degree;
};

/**
 * Draws a stretched out and flattened cube to represent the ground plane.
 * @param model_transform Current matrix
 * @returns {*} Origin matrix
 */
Animation.prototype.ground = function (model_transform) {
    var GROUND_TEXTURE = new Material(vec4(.5, .5, .5, 1), 1, 1, 1, 40, "textures/dirt.jpg");
    var GROUND_WIDTH = 1000;
    var GROUND_THICKNESS = 0.1;

    var origin = model_transform;
    var ground = origin;
    ground = mult(ground, translate(0, -GROUND_THICKNESS, 0));
    ground = mult(ground, scale(GROUND_WIDTH, GROUND_THICKNESS, GROUND_WIDTH));
    this.m_cube.draw(this.graphicsState, ground, GROUND_TEXTURE);

    return origin;
};

/**
 * Draws a tank with a swiveling turret.
 */
Animation.prototype.tank = function (model_transform, turretRotation) {
    var armor = new Material(vec4(.5, .5, .5, 1), 1, 1, 1, 40, "textures/woodland.png");
    var BARREL_LENGTH = 6;

    var origin = model_transform;

    var chassisOrigin = mult(origin, translate(0, 0.5, 0));
    var chassis = mult(chassisOrigin, scale(2, 0.5, 1.8));
    this.m_parallelogon.draw(this.graphicsState, chassis, armor);

    var turretOrigin = mult(chassisOrigin, translate(-1.5, 1, 0));
    turretOrigin = mult(turretOrigin, rotate(turretRotation, 0, 1, 0));
    var turret = mult(turretOrigin, scale(1, 0.4, 1.5));
    this.m_parallelogon.draw(this.graphicsState, turret, armor);

    var barrelOrigin = mult(turretOrigin, translate(2.5, 0, 0));
    var barrel = mult(barrelOrigin, rotate(90, 0, 1, 0));
    barrel = mult(barrel, scale(0.15, 0.15, 6));
    this.m_cylinder.draw(this.graphicsState, barrel, armor);

    return origin;
};

Animation.prototype.update_strings = function (debug_screen_object) {
    // Strings this particular class contributes to the UI
    debug_screen_object.string_map["time"] = "Animation Time: " + this.graphicsState.animation_time / 1000 + "s";
    debug_screen_object.string_map["animate"] = "Animation " + (animate ? "on" : "off");
    debug_screen_object.string_map["FPS"] = "FPS: " + 1000 / this.animation_delta_time;
};
