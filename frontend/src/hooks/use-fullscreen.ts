import { useCallback, useEffect, useRef, useState } from "react";

export function useFullscreen<T extends HTMLElement>() {
	const elementRef = useRef<T>(null);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const isFullscreenSupported =
		typeof document !== "undefined" &&
		document.fullscreenEnabled &&
		typeof HTMLElement !== "undefined" &&
		"requestFullscreen" in HTMLElement.prototype;

	useEffect(() => {
		function handleFullscreenChange(): void {
			setIsFullscreen(document.fullscreenElement === elementRef.current);
		}

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	const toggleFullscreen = useCallback((): void => {
		const element = elementRef.current;
		if (!element || !document.fullscreenEnabled) return;

		const fullscreenOperation =
			document.fullscreenElement === element
				? document.exitFullscreen()
				: element.requestFullscreen();

		void fullscreenOperation.catch(() => {
			setIsFullscreen(document.fullscreenElement === element);
		});
	}, []);

	return {
		elementRef,
		isFullscreen,
		isFullscreenSupported,
		toggleFullscreen,
	} as const;
}
