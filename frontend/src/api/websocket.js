export class WebSocketClient {
      constructor(url, onMessage, onOpen, onClose) {
            this.url = url;
            this.socket = null;
            this.onMessage = onMessage;
            this.onOpen = onOpen;
            this.onClose = onClose;
      }

      connect() {
            this.socket = new WebSocket(this.url);

            this.socket.onopen = () => {
                  console.log('WebSocket connected');
                  if (this.onOpen) this.onOpen();
            };

            this.socket.onmessage = (event) => {
                  if (this.onMessage) this.onMessage(event);
            };

            this.socket.onclose = () => {
                  console.log('WebSocket disconnected');
                  if (this.onClose) this.onClose();
            };

            this.socket.onerror = (error) => {
                  console.error('WebSocket error:', error);
            };
      }

      send(data) {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                  this.socket.send(data);
            } else {
                  console.warn('WebSocket is not open');
            }
      }

      disconnect() {
            if (this.socket) {
                  this.socket.close();
            }
      }
}
