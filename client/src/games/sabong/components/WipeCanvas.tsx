import { useImperativeHandle, useRef, useLayoutEffect } from "react";
import { useWaveShader } from "../../../hooks/animation/useWaveShader";
import { tweenRaf } from "../../../lib/animation/tweenRaf";

export interface WipeHandle {
	wipe(onMidpoint: () => void): Promise<void>;
}

interface Props {
	ref?: React.Ref<WipeHandle>;
	color?: [number, number, number];
	duration?: number;
}

export function WipeCanvas({ ref, color = [0, 0, 0], duration = 0.5 }: Props) {
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
					const ms = duration * 1000;
					let cancelCurrent: (() => void) | null = null;

					const runWipeOut = () => {
						updateParams({ flip: 1.0, threshold: -0.15 });
						cancelCurrent = tweenRaf(
							-0.15,
							1.0,
							ms,
							(v) => { updateParams({ threshold: v }); },
							() => {
								stopLoop();
								resolve();
							},
						);
					};

					updateParams({ flip: 0.0, threshold: -0.15 });
					startLoop();

					cancelCurrent = tweenRaf(
						-0.15,
						1.0,
						ms,
						(v) => { updateParams({ threshold: v }); },
						() => {
							onMidpoint();
							runWipeOut();
						},
					);

					return () => cancelCurrent?.();
				});
			},
		}),
		[duration, startLoop, stopLoop, updateParams],
	);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			tabIndex={-1}
			className="absolute inset-0 w-full h-full pointer-events-none z-50"
		/>
	);
}