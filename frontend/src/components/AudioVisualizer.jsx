import React, { useEffect, useRef } from 'react';

const AudioVisualizer = ({ analyser }) => {
      const canvasRef = useRef(null);

      useEffect(() => {
            if (!analyser || !canvasRef.current) return;

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const draw = () => {
                  requestAnimationFrame(draw);
                  analyser.getByteFrequencyData(dataArray);

                  ctx.fillStyle = '#1a1a1a'; // Match background
                  ctx.fillRect(0, 0, canvas.width, canvas.height);

                  const barWidth = (canvas.width / bufferLength) * 2.5;
                  let barHeight;
                  let x = 0;

                  for (let i = 0; i < bufferLength; i++) {
                        barHeight = dataArray[i] / 2;

                        // Gradient color: nvidia green to white
                        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                        gradient.addColorStop(0, '#76b900');
                        gradient.addColorStop(1, '#ffffff');

                        ctx.fillStyle = gradient;
                        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

                        x += barWidth + 1;
                  }
            };

            draw();
      }, [analyser]);

      return (
            <canvas
                  ref={canvasRef}
                  width={600}
                  height={150}
                  className="w-full h-full rounded-lg shadow-lg border border-white/10"
            />
      );
};

export default AudioVisualizer;
