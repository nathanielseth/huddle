import {
	forwardRef,
	useImperativeHandle,
	useRef,
	useLayoutEffect,
} from "react";
import { animate } from "motion";
import { useWaveShader } from "../../../hooks/useWaveShader";

export interface WipeHandle {
	wipe(onMidpoint: () => void): Promise<void>;
}

interface Props {
	color?: [number, number, number];
	duration?: number;
}

export const WipeCanvas = forwardRef<WipeHandle, Props>(
	({ color = [0, 0, 0], duration = 0.5 }, ref) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const { startLoop, stopLoop, updateParams } = useWaveShader(canvasRef);

		useLayoutEffect(() => {
			updateParams({ color });
		}, [color, updateParams]);

		useImperativeHandle(
			ref,
			() => ({
				wipe(onMidpoint) {
					return new Promise<void>((resolve) => {
						const ease = [0.76, 0, 0.24, 1] as const;

						// wipe in
						updateParams({ flip: 0.0, threshold: -0.15 });
						startLoop();

						animate(-0.15, 1.0, {
							duration,
							ease,
							onUpdate: (v) => updateParams({ threshold: v }),
							onComplete: () => {
								onMidpoint();

								// wipe out
								updateParams({ flip: 1.0, threshold: -0.15 });

								animate(-0.15, 1.0, {
									duration,
									ease,
									onUpdate: (v) => updateParams({ threshold: v }),
									onComplete: () => {
										stopLoop();
										resolve();
									},
								});
							},
						});
					});
				},
			}),
			[duration, startLoop, stopLoop, updateParams],
		);

		return (
			<canvas
				ref={canvasRef}
				aria-hidden="true"
				className="absolute inset-0 w-full h-full pointer-events-none z-50"
			/>
		);
	},
);

WipeCanvas.displayName = "WipeCanvas";
