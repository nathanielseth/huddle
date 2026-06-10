import { useRef, useEffect } from "react";
import type { RefObject } from "react";

// shaders
const VERT = `#version 300 es
  in vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
  precision highp float; // upgraded to highp for modern gpu precision

  uniform vec2  u_res;
  uniform float u_threshold;
  uniform float u_time;
  uniform float u_flip;
  uniform vec3  u_color;

  out vec4 fragColor;

  void main() {
    vec2 UV = gl_FragCoord.xy / u_res;
    UV.y = 1.0 - UV.y;

    float col = UV.x + UV.y * 0.2
      + sin(20.0 * (UV.y + u_threshold * 3.0)) * 0.03
      + sin(10.0 * (UV.y + u_threshold * 2.0)) * 0.03;
    col /= 1.26;

    float alpha   = step(col, u_threshold);
    float pattern = UV.x + UV.y * 0.1 - u_time * 0.015;
    pattern       = step(sin(pattern * 80.0), 0.01) * 0.25 + 0.75;

    fragColor = vec4(u_color * pattern, abs(u_flip - alpha));
  }
`;

// types
export type WaveParams = {
	threshold: number;
	flip: number;
	color: [number, number, number];
};

type Uniforms = Record<string, WebGLUniformLocation | null>;

type GLResources = {
	prog: WebGLProgram;
	vert: WebGLShader;
	frag: WebGLShader;
	buf: WebGLBuffer;
	vao: WebGLVertexArrayObject;
};

type GLState = {
	gl: WebGL2RenderingContext;
	res: GLResources;
	u: Uniforms;
	raf: number;
	start: number;
};

// webgl helpers
function compileShader(
	gl: WebGL2RenderingContext,
	type: number,
	src: string,
): WebGLShader {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, src);
	gl.compileShader(shader);

	if (
		import.meta.env.DEV &&
		!gl.getShaderParameter(shader, gl.COMPILE_STATUS)
	) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`[WaveShader] Compile error:\n${log}`);
	}

	return shader;
}

function initWebGL(gl: WebGL2RenderingContext): GLResources {
	const vert = compileShader(gl, gl.VERTEX_SHADER, VERT);
	const frag = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);

	const prog = gl.createProgram()!;
	gl.attachShader(prog, vert);
	gl.attachShader(prog, frag);
	gl.linkProgram(prog);

	if (import.meta.env.DEV && !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		throw new Error(`[WaveShader] Link error:\n${gl.getProgramInfoLog(prog)}`);
	}

	// detach so driver can free intermediate objects
	gl.detachShader(prog, vert);
	gl.detachShader(prog, frag);

	// use vertex array objects
	const vao = gl.createVertexArray()!;
	gl.bindVertexArray(vao);

	const buf = gl.createBuffer()!;
	gl.bindBuffer(gl.ARRAY_BUFFER, buf);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
		gl.STATIC_DRAW,
	);

	const loc = gl.getAttribLocation(prog, "a_pos");
	gl.enableVertexAttribArray(loc);
	gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

	// unbind vao to prevent accidental modification elsewhere
	gl.bindVertexArray(null);

	// one-time gl state
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0, 0, 0, 0);

	gl.useProgram(prog);

	return { prog, vert, frag, buf, vao };
}

function destroyWebGL(gl: WebGL2RenderingContext, res: GLResources): void {
	gl.deleteProgram(res.prog);
	gl.deleteShader(res.vert);
	gl.deleteShader(res.frag);
	gl.deleteBuffer(res.buf);
	gl.deleteVertexArray(res.vao);
}

function rafTick(
	glStateRef: React.RefObject<GLState | null>,
	paramsRef: React.RefObject<WaveParams>,
	start: number,
) {
	const state = glStateRef.current;
	if (!state) return; // unmounted — exit cleanly

	if (!document.hidden) {
		const { gl, res, u } = state;
		const { threshold, flip, color } = paramsRef.current;
		const t = (performance.now() - start) / 1000;

		gl.uniform1f(u.u_threshold, threshold);
		gl.uniform1f(u.u_time, t);
		gl.uniform1f(u.u_flip, flip);
		gl.uniform3f(u.u_color, color[0], color[1], color[2]);

		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.bindVertexArray(res.vao);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
		gl.bindVertexArray(null);
	}

	state.raf = requestAnimationFrame(() =>
		rafTick(glStateRef, paramsRef, start),
	);
}

function startLoop(
	glStateRef: React.RefObject<GLState | null>,
	paramsRef: React.RefObject<WaveParams>,
) {
	const s = glStateRef.current;
	if (!s) return;
	cancelAnimationFrame(s.raf);
	s.raf = requestAnimationFrame(() => rafTick(glStateRef, paramsRef, s.start));
}

function stopLoop(glStateRef: React.RefObject<GLState | null>) {
	const s = glStateRef.current;
	if (s) cancelAnimationFrame(s.raf);
}

function updateParams(
	paramsRef: React.RefObject<WaveParams>,
	next: Partial<WaveParams>,
) {
	Object.assign(paramsRef.current, next);
}

// hook
const DEFAULT_PARAMS: WaveParams = {
	threshold: -0.15,
	flip: 0.0,
	color: [0, 0, 0],
};

export function useWaveShader(canvasRef: RefObject<HTMLCanvasElement | null>) {
	const glState = useRef<GLState | null>(null);
	const params = useRef<WaveParams>({ ...DEFAULT_PARAMS });

	// init / cleanup
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("webgl2", {
			alpha: true,
			antialias: false,
			depth: false,
		});

		if (!ctx) {
			console.error("[WaveShader] WebGL2 not supported.");
			return;
		}

		const res = initWebGL(ctx);

		const u: Uniforms = {
			u_res: ctx.getUniformLocation(res.prog, "u_res"),
			u_threshold: ctx.getUniformLocation(res.prog, "u_threshold"),
			u_time: ctx.getUniformLocation(res.prog, "u_time"),
			u_flip: ctx.getUniformLocation(res.prog, "u_flip"),
			u_color: ctx.getUniformLocation(res.prog, "u_color"),
		};

		glState.current = { gl: ctx, res, u, raf: 0, start: performance.now() };

		const resize = () => {
			const dpr = window.devicePixelRatio ?? 1;
			const w = Math.round(canvas.offsetWidth * dpr);
			const h = Math.round(canvas.offsetHeight * dpr);
			canvas.width = w;
			canvas.height = h;
			ctx.viewport(0, 0, w, h);
			ctx.uniform2f(u.u_res, w, h);
		};

		const ro = new ResizeObserver(resize);
		ro.observe(canvas);
		resize();

		return () => {
			ro.disconnect();
			const s = glState.current;
			if (!s) return;
			cancelAnimationFrame(s.raf);
			destroyWebGL(s.gl, s.res);
			glState.current = null;
		};
	}, [canvasRef]); // refobject identity is stable across renders

	return {
		startLoop: () => startLoop(glState, params),
		stopLoop: () => stopLoop(glState),
		updateParams: (next: Partial<WaveParams>) => updateParams(params, next),
	} as const;
}