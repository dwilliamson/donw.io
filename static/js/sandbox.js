
WebGLSandbox = (function(){

// ====================================================================================== //
//    JAVASCRIPT UTILITIES
// ====================================================================================== //


function FatalError(error)
{
	var exception = { message: error };
	throw exception;
}


function ClearError(status_bar)
{
	status_bar.innerHTML = "Status: OK";
	status_bar.style.color = "FFF";
}


function SetError(status_bar, error)
{
	status_bar.innerHTML = "Status: <span style='color:#f44'>Errors</span><br/>" + error;
}


function EndsWith(str, suffix)
{
	return str.indexOf(suffix, str.length - suffix.length) !== -1;
}


function GetDocument(filename, callback)
{
	// Create a new object for each request
	var req;
	if (window.XMLHttpRequest)
		req = new XMLHttpRequest();
	else
		req = new ActiveXObject("Microsoft.XMLHTTP");

	if (req)
	{
		// Setup the callback
		if (callback)
		{
			req.onreadystatechange = function()
			{
				if (req.readyState == 4 && req.status == 200)
					callback(req.responseText);
			}
		}

		// Kick-off a request with async if a callback is provided
		req.open("GET", filename, callback ? true : false);
		req.send();

		// Return the result when blocking
		if (!callback && req.status == 200)
			return req.responseText;
	}

	return null;
}


function HashString(str)
{
	var hash = 5381;
	for (var i = 0; i < str.length; i++)
	{
		var c = str.charCodeAt(i);
		hash = c + (hash << 6) + (hash << 16) - hash;
	}
	return hash;
}



// ====================================================================================== //
//    GEOMETRY UTILITIES
// ====================================================================================== //


var IndexType = {
	TRIANGLE_STRIP : 0,
	TRIANGLE_LIST : 1,
};


Geometry = (function()
{
	function Geometry(index_type, vertices, indices)
	{
		this.IndexType = index_type;
		this.Vertices = vertices;
		this.Indices = indices;
	}

	return Geometry;
})();



function CreatePlaneGeometry(scale, nb_vertices_x)
{
	var positions = new Array();

	// Generate a linear array of vertices
	var mid = scale / 2.0;
	scale *= (1.0 / (nb_vertices_x - 1.0));
	for (var y = 0, i = 0; y < nb_vertices_x; y++)
	{
		for (var x = 0; x < nb_vertices_x; x++, i++)
		{
			// Calculate position
			var p = vec3.create();
			p[0] = x * scale - mid;
			p[1] = 1;
			p[2] = y * scale - mid;
			positions.push(p);
		}
	}

	var indices = new Array();

	// Triangle strip the plane
	for (var y = 0; y < nb_vertices_x - 1; y++)
	{
		// Strip-join double-tap
		var index = y * nb_vertices_x;
		indices.push(index);

		// Strip this row
		for (var x = 0; x < nb_vertices_x; x++)
		{
			indices.push(index);
			indices.push(index + nb_vertices_x);
			index++;
		}

		// Strip-join double-tap
		indices.push((index - 1) + nb_vertices_x);
	}

	return new Geometry(IndexType.TRIANGLE_STRIP, positions, indices);
}


function CreateCubeGeometry(scale_x, nb_vertices_x)
{
	var vertices = new Array();
	var indices = new Array();

	// Iterate over every face on the box
	for (var i = 0; i < 6; i++)
	{
		var axis = Math.floor(i / 2);
		var angle = (i & 1) ? Math.PI / 2 : -Math.PI / 2;
		var side = (i & 1) ? 1.0 : -1.0;

		var scale = vec3.create();
		var rotation = mat4.create();
		var position = vec3.create();

		// Determine the scale, rotation and position for the plane vertices
		vec3.set(scale, scale_x, 1, scale_x);
		switch (axis)
		{
			case 0:
				mat4.rotateZ(rotation, rotation, angle);
				vec3.set(position, scale_x * side, 0, 0);
				break;
			case 1:
				mat4.rotateX(rotation, rotation, angle + Math.PI / 2);
				vec3.set(position, 0, scale_x * side, 0);
				break;
			case 2:
				mat4.rotateX(rotation, rotation, angle);
				vec3.set(position, 0, 0, scale_x * side);
				break;
		}

		// Generate a plane for each face and transform its vertices to fit the face
		var plane_geom = CreatePlaneGeometry(1, nb_vertices_x);
		var plane_vertices = plane_geom.Vertices;
		for (var j = 0; j < plane_vertices.length; j++)
		{
			var v = plane_vertices[j];
			vec3.mul(v, v, scale);
			vec3.transformMat4(v, v, rotation);
		}

		// Merge
		// Indices have already been double-tapped for join
		var plane_indices = plane_geom.Indices;
		for (var j = 0; j < plane_indices.length; j++)
			indices.push(plane_indices[j] + vertices.length);
		vertices = vertices.concat(plane_vertices);
	}

	return new Geometry(IndexType.TRIANGLE_STRIP, vertices, indices);
}


function CreateOctahedronGeometry()
{
	// http://en.wikipedia.org/wiki/Octahedron
	// http://en.wikipedia.org/wiki/Octahedron#mediaviewer/File:Dual_Cube-Octahedron.svg
	// Octahedron is dual to the cube with a point in the centre of each of its faces

	// Create vertex positions on the 6 cube faces
	var positions = [
		[  0,  1,  0 ],
		[  0,  0, -1 ],
		[  1,  0,  0 ],
		[  0,  0,  1 ],
		[ -1,  0,  0 ],
		[  0, -1,  0 ],
	];
	var position_array = new Array();
	for (var i in positions)
	{
		var p = vec3.create();
		p[0] = positions[i][0];
		p[1] = positions[i][1];
		p[2] = positions[i][2];
		position_array.push(p);
	}

	// Link octahedron triangles
	var indices = [
		0, 1, 2,
		0, 2, 3,
		0, 3, 4,
		0, 4, 1,
		5, 1, 2,
		5, 2, 3,
		5, 3, 4,
		5, 4, 1
	];
	var index_array = new Array();
	for (var i in indices)
		index_array.push(indices[i]);

	return new Geometry(IndexType.TRIANGLE_LIST, position_array, index_array);
}


function CreateIcosahedronGeometry()
{
	// http://en.wikipedia.org/wiki/Icosahedron
	// http://en.wikipedia.org/wiki/Regular_icosahedron

	// Golden ratio
	var t = (1.0 + Math.sqrt(5.0)) / 2.0;

	// All permutations of (t, 1, 0) to generate vertices, including sign flips
	// Called "snub tetrahedron" construction
	var positions = [
		[ -1,  t,  0 ],
		[  1,  t,  0 ],
		[ -1, -t,  0 ],
		[  1, -t,  0 ],

		[  0, -1,  t ],
		[  0,  1,  t ],
		[  0, -1, -t ],
		[  0,  1, -t ],

		[  t,  0, -1 ],
		[  t,  0,  1 ],
		[ -t,  0, -1 ],
		[ -t,  0,  1 ]
	];

	// Positions don't lie on unit sphere so need normalising
	var position_array = new Array();
	for (var i in positions)
	{
		var p = vec3.create();
		p[0] = positions[i][0];
		p[1] = positions[i][1];
		p[2] = positions[i][2];
		vec3.normalize(p, p);
		position_array.push(p);
	}

	// Index list by Andreas Kahler
	// http://blog.andreaskahler.com/2009/06/creating-icosphere-mesh-in-code.html
	var indices = [
		// 5 faces around point 0
		0, 11, 5,
		0, 5, 1,
		0, 1, 7,
		0, 7, 10,
		0, 10, 11,

		// 5 adjacent faces
		1, 5, 9,
		5, 11, 4,
		11, 10, 2,
		10, 7, 6,
		7, 1, 8,

		// 5 faces around point 3
		3, 9, 4,
		3, 4, 2,
		3, 2, 6,
		3, 6, 8,
		3, 8, 9,

		// 5 adjacent faces
		4, 9, 5,
		2, 4, 11,
		6, 2, 10,
		8, 6, 7,
		9, 8, 1
	];
	var index_array = new Array();
	for (var i in indices)
		index_array.push(indices[i]);

	return new Geometry(IndexType.TRIANGLE_LIST, position_array, index_array);
}


function CreateWireframeIndices(index_type, indices)
{
	var wireframe_indices = new Array();

	switch (index_type)
	{
		case IndexType.TRIANGLE_STRIP:
			var index_limit = indices.length - 2;
			var index_skip = 1;
			break;
		case IndexType.TRIANGLE_LIST:
			var index_limit = indices.length;
			var index_skip = 3;
			break;
	}

	for (var i = 0; i < index_limit; i += index_skip)
	{
		// Strip/list unpack
		var i0 = indices[i];
		var i1 = indices[i + 1];
		var i2 = indices[i + 2];

		// Ignore degenerate strip joins
		if (i0 == i1 || i0 == i2 || i1 == i2)
			continue;

		// Pack as a line list
		wireframe_indices.push(i0);
		wireframe_indices.push(i1);
		wireframe_indices.push(i1);
		wireframe_indices.push(i2);
		wireframe_indices.push(i2);
		wireframe_indices.push(i0);
	}

	return wireframe_indices;
}


function QuadrifyWireframeIndices(indices)
{
	// Assuming the a triangulated list of quads, pull out the quad diagonals
	var filtered_indices = new Array();
	function Add(base)
	{
		for (var i = 1; i < arguments.length; i++)
			filtered_indices.push(indices[base + arguments[i]]);
	}
	for (var i = 0; i < indices.length; i += 12)
		Add(i, 0, 1, 4, 5, 8, 9, 10, 11);
	return filtered_indices;
}


function SubdivideTriangleList(positions, indices)
{
	var out_indices = new Array();

	// Use an object as an associative map of edge pairs
	// Not ideal as JS will convert the integer keys to strings, but, it's quick and dirty...
	var MAX_NB_INDICES = 32768;
	var edge_splits = new Object();

	function make_edge_key(i0, i1)
	{
		// Ensure lowest edge index is first to ensure consistent key between different edge directions
		if (i1 < i0)
		{
			var temp = i0;
			i0 = i1;
			i1 = temp;
		}

		// Check for overflow
		if (i1 >= MAX_NB_INDICES)
			throw new Error("Edge split table not big enough to handle index: " + i1);

		return i0 * MAX_NB_INDICES + i1;
	}

	function slerp(out, a, b, t)
	{
		// Cosine of angle between two vectors
		var cos_theta = vec3.dot(a, b);
		cos_theta = Math.min(Math.max(cos_theta, -1), 1);

		// Calculate interpolated angle
		var theta = Math.acos(cos_theta) * t;

		//var sin_theta = Math.sin(theta);
		//var s0 = Math.sin((1 - t) * theta) / sin_theta;
		//var s1 = Math.sin(t * theta) / sin_theta;

		var relative = vec3.create();
		vec3.scale(relative, a, cos_theta);
		vec3.sub(relative, b, relative);
		vec3.normalize(relative, relative);

		vec3.scale(relative, relative, Math.sin(theta));
		vec3.scale(out, a, Math.cos(theta));
		vec3.add(out, out, relative);
	}

	function split_edge(positions, i0, i1)
	{
		// Check first to see if the edge has been split before
		var edge_key = make_edge_key(i0, i1);
		var edge_split = edge_splits[edge_key];
		if (edge_split !== undefined)
			return edge_split;

		// Lookup edge vertex positions
		var p0 = positions[i0];
		var p1 = positions[i1];

		// Generate a midpoint
		var p01 = vec3.create();
		vec3.lerp(p01, p0, p1, 0.5);
		//slerp(p01, p0, p1, 0.5);

		// Add the new vertex position and index to the edge split table
		positions.push(p01);
		edge_split = positions.length - 1;
		edge_splits[edge_key] = edge_split;

		return edge_split;
	}

	for (var i = 0; i < indices.length; i += 3)
	{
		// Get vertex indices of the triangle
		var i0 = indices[i + 0];
		var i1 = indices[i + 1];
		var i2 = indices[i + 2];

		// Split the edges of the triangle
		var i01 = split_edge(positions, i0, i1);
		var i12 = split_edge(positions, i1, i2);
		var i20 = split_edge(positions, i2, i0);

		// Add indices for the 4 new triangles
		var new_indices = [
			i0,  i01, i20,
			i01, i1,  i12,
			i20, i01, i12,
			i20, i12, i2 
		];
		for (var j in new_indices)
			out_indices.push(new_indices[j]);
	}

	return out_indices;
}


function SubdivideGeometryTriangleList(geometry)
{
	if (geometry.IndexType == IndexType.TRIANGLE_LIST)
		geometry.Indices = SubdivideTriangleList(geometry.Vertices, geometry.Indices);
}


function ProjectVerticesToSphere(vertices)
{
	for (var i in vertices)
	{
		var vertex = vertices[i];
		vec3.normalize(vertex, vertex);
	}
}



// ====================================================================================== //
//    WEBGL UTILITIES
// ====================================================================================== //


function CreateShader(gl, type, source)
{
	// Create and compile the shader
	var shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	// Report any compilation errors
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
		FatalError(gl.getShaderInfoLog(shader));

	return shader;
}


function LoadShader(gl, filename)
{
	// Block loading the shader
	var source = GetDocument(filename, null);
	if (!source)
		FatalError("Failed to load shader: " + filename);

	// Decide the shader type from the filename extension
	var type = gl.FRAGMENT_SHADER;
	if (EndsWith(filename.toLowerCase(), ".vsh"))
		type = gl.VERTEX_SHADER;

	return CreateShader(gl, type, source);
}


function CreateVertexBuffer(gl, vertices)
{
	// Create the vertex buffer
	var vbuffer = gl.createBuffer();
	if (!vbuffer)
		FatalError("Failed to create vertex buffer");

	// Concatenate into a float32 array
	var all_vertices = new Float32Array(vertices.length * 3);
	for (var i = 0; i < vertices.length; i++)
		all_vertices.set(vertices[i], i * 3);

	// Set the vertex buffer data
	gl.bindBuffer(gl.ARRAY_BUFFER, vbuffer);
	gl.bufferData(gl.ARRAY_BUFFER, all_vertices, gl.STATIC_DRAW);
	vbuffer.nb_vertices = vertices.length;

	return vbuffer;
}


function CreateIndexBuffer(gl, indices)
{
	// Create the index buffer
	var ibuffer = gl.createBuffer();
	if (!ibuffer)
		FatalError("Failed to create index buffer");

	// Set the index buffer data
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
	ibuffer.nb_indices = indices.length;

	return ibuffer;
}


function GetShaderUniform(gl, program, uniform_name)
{
	var uniform = gl.getUniformLocation(program, uniform_name);
	if (!uniform)
		FatalError("Couldn't locate uniform: " + uniform_name);

	return uniform;
}


function SetShaderUniformFloat(gl, program, uniform_name, value)
{
	var uniform = GetShaderUniform(gl, program, uniform_name);
	if (uniform)
		gl.uniform1f(uniform, value);
}


function SetShaderUniformVector3(gl, program, uniform_name, vector)
{
	var uniform = GetShaderUniform(gl, program, uniform_name);
	if (uniform)
		gl.uniform3fv(uniform, vector);
}


function SetShaderUniformMatrix4(gl, program, uniform_name, matrix)
{
	var uniform = GetShaderUniform(gl, program, uniform_name);
	if (uniform)
		gl.uniformMatrix4fv(uniform, false, matrix);
}


function InitWebGL(canvas, status_bar)
{
	// Get WebGL context
	var gl = null;
	try
	{
		gl = canvas.getContext("webgl", { antialias: true }) || canvas.getContext("experimental-webgl", { antialias: true });
	}
	catch (e)
	{
	}

	// Blitz page on error
	if (!gl)
		SetError(status_bar, "Couldn't initialise WebGL");

	return gl;
}



// ====================================================================================== //
//    INPUT UTILITIES
// ====================================================================================== //



var Keys = {

	// ASCII Keys
	W: 87,
	S: 83,
	A: 65,
	D: 68,

	SPACE:32,
	SHIFT:16,

	// Hijack with mouse keys
	MB:0,
};


Input = (function()
{
	function Input(canvas)
	{
		// Initialise default state
		this.KeyState = [ ];
		this.MouseDelta = [ 0, 0 ];
		this.LastMouseDragPos = null;

		// Set event handlers
		var self = this;
		canvas.onkeydown = function(ev) { OnKeyDown(self, ev); };
		canvas.onkeyup = function(ev) { OnKeyUp(self, ev); };
		canvas.onmousedown = function(ev) { OnMouseDown(self, ev); };
		canvas.onmouseup = function(ev) { OnMouseUp(self, ev); };
		canvas.onmouseout = function(ev) { OnMouseOut(self, ev); };
		canvas.onmousemove = function(ev) { OnMouseMove(self, ev); };
	}

	// Listening for keyboard events requires tabindex set on the canvas so that it can focus
	function OnKeyDown(self, ev)
	{
		self.KeyState[ev.keyCode] = true;
	}
	function OnKeyUp(self, ev)
	{
		self.KeyState[ev.keyCode] = false;
	}

	// Handle mouse presses
	function OnMouseDown(self, ev)
	{
		self.KeyState[Keys.MB] = true;
		self.LastMouseDragPos = [ ev.clientX, ev.clientY ];
	}
	function OnMouseUp(self, ev)
	{
		self.KeyState[Keys.MB] = false;
		self.LastMouseDragPos = null;
	}
	function OnMouseOut(self, ev)
	{
		self.KeyState[Keys.MB] = false;
		self.LastMouseDragPos = null;
	}

	// Handle mouse move dragging
	function OnMouseMove(self, ev)
	{
		if (self.LastMouseDragPos)
		{
			self.MouseDelta[0] += ev.clientX - self.LastMouseDragPos[0];
			self.MouseDelta[1] += ev.clientY - self.LastMouseDragPos[1];
			self.LastMouseDragPos[0] = ev.clientX;
			self.LastMouseDragPos[1] = ev.clientY;
		}
	}
	
	return Input;
})();



// ====================================================================================== //
//    MAIN PROGRAM
// ====================================================================================== //



// Create a vector colour enum
var Colours = {
	BLACK : [ 0, 0, 0 ],
	WHITE : [ 1, 1, 1 ],
};

// Replace RGB triplets with vectors
for (var i in Colours)
{
	var rgb = Colours[i];
	var vec = vec3.create();
	vec3.set(vec, rgb[0], rgb[1], rgb[2]);
	Colours[i] = vec;
}


var DrawType = {
	SOLID : 0,
	WIREFRAME_TRIS : 1,
	WIREFRAME_QUADS : 2,
};


// This kept around only during a single a session and cleared between edit sessions
// It exists purely to keep old shaders alive while their new replacements have errors
var g_ShaderMap = [ ];


Mesh = (function()
{
	function Mesh(gl, draw_type, geometry, program)
	{
		this.DrawType = draw_type;

		// Create the data buffers
		this.IndexType = geometry.IndexType;
		this.VertexBuffer = CreateVertexBuffer(gl, geometry.Vertices);
		this.IndexBuffer = CreateIndexBuffer(gl, geometry.Indices);

		// Create wireframe index buffers if needed
		if (draw_type == DrawType.WIREFRAME_TRIS || draw_type == DrawType.WIREFRAME_QUADS)
		{
			var wireframe_indices = CreateWireframeIndices(geometry.IndexType, geometry.Indices);
			if (draw_type == DrawType.WIREFRAME_QUADS)
				wireframe_indices = QuadrifyWireframeIndices(wireframe_indices);
			this.WireframeIndexBuffer = CreateIndexBuffer(gl, wireframe_indices);
		}

		this.Program = program;
	}

	return Mesh;

})();


var CameraType = {
	FLY : 0,
	ROTATE : 1,
};


Scene = (function()
{
	function Scene(gl, vshader, fshader, canvas)
	{
		// Create matrices
		this.CameraRotationMatrix = mat4.create();
		this.glInvViewMatrix = mat4.create();
		this.glViewMatrix = mat4.create();

		// List of meshes to render in the scene
		this.Meshes = [ ];

		// Bind the scene to the context
		this.gl = gl;

		// Embed the program in the scene
		this.VertexShader = vshader;
		this.FragmentShader = fshader;

		// Get canvas dimensions
		this.CanvasWidth = canvas.width;
		this.CanvasHeight = canvas.height;
		this.AspectRatio = this.CanvasWidth / this.CanvasHeight;

		// Set a default perspective matrix
		this.glProjectionMatrix = mat4.create();
		mat4.perspective(this.glProjectionMatrix, 45, this.AspectRatio, 0.1, 100.0);

		// Set default camera orientation
		this.CameraPosition = vec3.create();
		this.CameraRotation = vec3.create();
		vec3.set(this.CameraPosition, 0, 0, 3);
		vec3.set(this.CameraRotation, 0, 0, 0);
		this.CameraType = CameraType.ROTATE;

		this.UpdateMatrices();
	}


	Scene.prototype.UpdateRotationMatrix = function()
	{
		mat4.identity(this.CameraRotationMatrix);
		mat4.rotateY(this.CameraRotationMatrix, this.CameraRotationMatrix, this.CameraRotation[1]);
		mat4.rotateX(this.CameraRotationMatrix, this.CameraRotationMatrix, this.CameraRotation[0]);
		return this.CameraRotationMatrix;
	}


	Scene.prototype.UpdateMatrices = function()
	{
		this.UpdateRotationMatrix();

		// Calculate view matrix from the camera
		mat4.identity(this.glInvViewMatrix);
		mat4.translate(this.glInvViewMatrix, this.glInvViewMatrix, this.CameraPosition);
		if (this.CameraType == CameraType.ROTATE)
			mat4.mul(this.glInvViewMatrix, this.CameraRotationMatrix, this.glInvViewMatrix);
		else
			mat4.mul(this.glInvViewMatrix, this.glInvViewMatrix, this.CameraRotationMatrix);
		mat4.invert(this.glViewMatrix, this.glInvViewMatrix);
	}


	Scene.prototype.AddMesh = function(draw_type, geometry, vshader_source, fshader_source)
	{
		var gl = this.gl;

		// Optionally compile a custom vertex shader for the mesh
		vshader = this.VertexShader;
		if (vshader_source !== undefined)
		{
			var custom_vshader = CreateShader(gl, gl.VERTEX_SHADER, vshader_source);
			if (custom_vshader != null)
				vshader = custom_vshader;
		}

		// Optionally compile a custom fragment shader for the mesh
		fshader = this.FragmentShader;
		if (fshader_source !== undefined)
		{
			var custom_fshader = CreateShader(gl, gl.FRAGMENT_SHADER, fshader_source);
			if (custom_fshader != null)
				fshader = custom_fshader;
		}

		// Create the shader program
		var program = gl.createProgram();
		gl.attachShader(program, fshader);
		gl.attachShader(program, vshader);
		gl.linkProgram(program);

		// Return on any errors
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			FatalError("Link Error: " + gl.getProgramInfoLog(program));

		var mesh = new Mesh(gl, draw_type, geometry, program);
		this.Meshes.push(mesh);
	}


	Scene.prototype.DrawMeshes = function()
	{
		this.UpdateMatrices();

		for (i in this.Meshes)
		{
			var mesh = this.Meshes[i];
			this.DrawMesh(mesh);
		}
	}


	function DrawMeshPass(self, mesh, type, colour)
	{
		var gl = self.gl;

		// Concatenate with identity to get model view for now
		var model_view = mat4.create();
		mat4.mul(model_view, model_view, self.glViewMatrix);

		// Apply program and set shader constants
		gl.useProgram(mesh.Program);
		SetShaderUniformMatrix4(gl, mesh.Program, "glProjectionMatrix", self.glProjectionMatrix);
		SetShaderUniformMatrix4(gl, mesh.Program, "glModelViewMatrix", model_view);
		SetShaderUniformVector3(gl, mesh.Program, "glColour", colour);

		// Setup the program attributes
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.VertexBuffer);
		var a_vpos = gl.getAttribLocation(mesh.Program, "glVertex");
		gl.enableVertexAttribArray(a_vpos);
		gl.vertexAttribPointer(a_vpos, 3, gl.FLOAT, false, 0, 0);

		// Decide which index buffer to use
		var ibuffer = mesh.IndexBuffer;
		if (type == gl.LINES)
			ibuffer = mesh.WireframeIndexBuffer;

		// Draw the mesh	
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuffer);
		gl.drawElements(type, ibuffer.nb_indices, gl.UNSIGNED_SHORT, 0);
	}


	Scene.prototype.DrawMesh = function(mesh)
	{
		var gl = this.gl;

		if (mesh.DrawType == DrawType.SOLID)
		{
			if (mesh.IndexType == IndexType.TRIANGLE_STRIP)
				DrawMeshPass(this, mesh, gl.TRIANGLE_STRIP, Colours.WHITE);
			else
				DrawMeshPass(this, mesh, gl.TRIANGLES, Colours.WHITE);
		}

		else if (mesh.DrawType == DrawType.WIREFRAME_QUADS || mesh.DrawType == DrawType.WIREFRAME_TRIS)
		{
			gl.depthRange(0.01, 1);
			if (mesh.IndexType == IndexType.TRIANGLE_STRIP)
				DrawMeshPass(this, mesh, gl.TRIANGLE_STRIP, Colours.BLACK);
			else
				DrawMeshPass(this, mesh, gl.TRIANGLES, Colours.BLACK);
			gl.depthRange(0, 1);
			DrawMeshPass(this, mesh, gl.LINES, Colours.WHITE);
		}
	}

	return Scene;

})();


function DrawScene(gl, scene, input)
{
	gl.clearColor(0, 0, 0, 1);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Update camera rotation and reset mouse delta
	scene.CameraRotation[0] -= input.MouseDelta[1] * 0.004;
	scene.CameraRotation[1] -= input.MouseDelta[0] * 0.004;
	var rotation_matrix = scene.UpdateRotationMatrix();
	input.MouseDelta[0] = 0;
	input.MouseDelta[1] = 0;

	// Construct movement vector frame from the rotation matrix
	var speed = 0.05;
	var forward = vec3.create();
	var right = vec3.create();
	var up = vec3.create();
	vec3.set(forward, 0, 0, -speed);
	vec3.set(right, speed, 0, 0);
	vec3.set(up, 0, speed, 0);
	if (scene.CameraType == CameraType.FLY)
	{
		vec3.transformMat4(forward, forward, rotation_matrix);
		vec3.transformMat4(right, right, rotation_matrix);
	}

	// Move the camera based on what the user presses
	if (input.KeyState[Keys.W])
		vec3.add(scene.CameraPosition, scene.CameraPosition, forward);
	if (input.KeyState[Keys.S])
		vec3.sub(scene.CameraPosition, scene.CameraPosition, forward);
	if (input.KeyState[Keys.A])
		vec3.sub(scene.CameraPosition, scene.CameraPosition, right);
	if (input.KeyState[Keys.D])
		vec3.add(scene.CameraPosition, scene.CameraPosition, right);
	if (input.KeyState[Keys.SPACE])
		vec3.add(scene.CameraPosition, scene.CameraPosition, up);
	if (input.KeyState[Keys.SHIFT])
		vec3.sub(scene.CameraPosition, scene.CameraPosition, up);

	scene.DrawMeshes();
}


function main(canvas, status_bar)
{
	// Resize the width of the canvas to that of its parent
	canvas.width = canvas.parentNode.offsetWidth;

	// Initialise and exit on error
	var gl = InitWebGL(canvas, status_bar);
	if (!gl)
		return null;
	var input = new Input(canvas);

	// Initialise the window with red backdrop
	gl.clearColor(1, 0, 0, 1);
	gl.clearDepth(1.0);
	gl.enable(gl.DEPTH_TEST);
	gl.depthFunc(gl.LEQUAL);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Create default shaders

	var fshader = CreateShader(gl, gl.FRAGMENT_SHADER, `
		#ifdef GL_ES
		precision highp float;
		#endif

		uniform vec3 glColour;

		void main(void)
		{
			gl_FragColor = vec4(glColour, 1);
		}
	`);

	var vshader = CreateShader(gl, gl.VERTEX_SHADER,`
		attribute vec3 glVertex;

		uniform mat4 glModelViewMatrix;
		uniform mat4 glProjectionMatrix;

		varying vec3 ls_Position;

		void main(void)
		{
			ls_Position = glVertex;
			gl_Position = glProjectionMatrix * glModelViewMatrix * vec4(glVertex, 1.0);
		}
	`);

	if (fshader == null || vshader == null)
		return null;

	var scene = new Scene(gl, vshader, fshader, canvas);

	(function animloop(){
		DrawScene(gl, scene, input);
		window.requestAnimationFrame(animloop);
	})();

	return scene;
}


function InitCodeMirror(code_editor, height_matcher)
{	
	var cm = CodeMirror.fromTextArea(
		code_editor,
		configuration =
		{
			theme: "monokai",
			mode: "javascript",
			indentUnit: 4,
			indentWithTabs: true,
			lineNumbers: true,
			matchBrackets: true,
			gutter: true,
		});

	cm.setSize(null, height_matcher.offsetHeight);
	return cm;
}


function ExecuteCode(cm, scene, status_bar, lsname)
{
	var old_scene_meshes = scene.Meshes;
	scene.Meshes = [ ];

	// Inject scene object into evaluated code
	var vars = { "scene" : scene };

	// Continuously save user's code
	var user_code = cm.getValue();
	if (typeof(localStorage) !== "undefined")
		localStorage[lsname + "_Code"] = user_code;

	// Split the user code into any specified buffers
	var buffer_re = /\/\/@buffer\(([^\)]*)\)/;
	user_code = user_code.split(buffer_re);

	// Inject named buffers into evaluated code
	for (var i = 1; i < user_code.length; i += 2)
	{
		var buffer_name = user_code[i];
		var buffer = user_code[i + 1];
		vars[buffer_name] = buffer;
	}

	// The first unnamed buffer is the one to the evaluate as javascript
	var eval_code = "with (vars) { " + user_code[0] + "}";

	try
	{
		ClearError(status_bar);
		eval(eval_code);
	}
	catch (e)
	{
		SetError(status_bar, e.message);
		scene.Meshes = old_scene_meshes;
	}
}


SandboxHTML = (function()
{
	function SandboxHTML(textarea, lsname)
	{
		// Create host HTML
		var div = document.createElement("div");
		var html = `
			<div class="wglsbx-CanvasHost">
				<canvas height="600" tabindex="1"></canvas>
				<div class="wglsbx-Buttons">Control Mode
					<label><input type="radio" name="select3" /><span>Fly</span></label>
					<label><input type="radio" name="select3" checked="true"/><span>Rotate</span></label>
				</div>
				<pre class="wglsbx-Status">Status: OK</pre>
			</div>

			<div class="wglsbx-CodeEditor">
			</div>
		`;

		// Set name of the radio button set
		var radio_set = lsname + "Radio";
		html = html.replace("select3", radio_set);
		html = html.replace("select3", radio_set);
		div.innerHTML = html;

		// Swap textarea with created div
		textarea.parentNode.insertBefore(div, textarea);
		textarea.parentNode.removeChild(textarea);

		// Record for future use
		this.Host = div.children[0];
		this.Editor = div.children[1];
		this.Canvas = this.Host.children[0];
		var buttons = this.Host.children[1];
		this.FlyButton = buttons.children[0].children[0];
		this.RotateButton = buttons.children[1].children[0];
		this.Status = this.Host.children[2];

		// Put textarea in the editor div
		this.Editor.appendChild(textarea);
	}

	SandboxHTML.prototype.OnControlModeChange = function(on_change)
	{
		// Map button check state to camera type
		var self = this;
		var GetCameraType = function()
		{
			return self.FlyButton.checked ? CameraType.FLY : CameraType.ROTATE;
		}

		// Setup events to pass new camera type changes
		this.FlyButton.onchange = function() { on_change(GetCameraType()); };
		this.RotateButton.onchange = function() { on_change(GetCameraType()); };
	}	

	return SandboxHTML;
})();


function SetupLiveEditEnvironment(textarea, lsname)
{
	var html = new SandboxHTML(textarea, lsname);

	// Start the code editor first to give the user something to look at in case scene
	// creation fails
	var cm = InitCodeMirror(html.Editor, html.Host);

	// Load existing code from user's local store
	if (typeof(Storage) !== "undefined")
	{
		var store = localStorage[lsname + "_Code"];
		if (store)
			cm.setValue(store);
	}

	// Oh, GOD... wait for the browser layout engine to complete after dynamic creation
	// of the sandbox, before creating the WebGL context that resizes itself to fit within
	window.setTimeout(function(){

		// Create the WebGL context/scene
		var scene = main(html.Canvas, html.Status);
		if (scene == null)
			return;

		// Change scene camera type on radio button select
		html.OnControlModeChange(function(camera_type) { scene.CameraType = camera_type; });

		// Perform the first code execution run
		ExecuteCode(cm, scene, html.Status, lsname);
		var last_code_hash = HashString(cm.getValue());

		// Check for code changes periodically
		setInterval(function()
		{
			var code_hash = HashString(cm.getValue());
			if (code_hash != last_code_hash)
			{
				last_code_hash = code_hash;
				ExecuteCode(cm, scene, html.Status, lsname);
			}
		}, 1000);

	}, 1);
}

return SetupLiveEditEnvironment;

})();
