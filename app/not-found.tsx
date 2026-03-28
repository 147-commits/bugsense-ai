export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-text-primary mb-4">404</h1>
        <p className="text-text-secondary mb-6">Page not found</p>
        <a href="/" className="text-accent-blue hover:underline">
          Go back home
        </a>
      </div>
    </div>
  );
}
