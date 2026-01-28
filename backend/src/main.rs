use axum::{
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod websocket;
mod nim_client;

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("--- BACKEND VERSION 2.1: LOCAL NIM FIX INSTALLED (Multipart Support) ---");
    tracing::info!("--- IF YOU SEE THIS, THE REBUILD WORKED ---");

    // Load .env
    dotenvy::dotenv().ok();

    tracing::info!("Starting NVIDIA NIM Speech-to-Speech Backend");

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any) // For development only
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/health", get(root))
        .route("/ws", get(websocket::ws_handler))
        .nest_service("/", tower_http::services::ServeDir::new("public"))
        .layer(cors)
        .layer(tower_http::trace::TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    tracing::info!("Listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn root() -> &'static str {
    "NVIDIA NIM Speech-to-Speech Backend Running"
}
