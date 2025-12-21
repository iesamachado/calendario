// Simple hash-based router for SPA navigation
export class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.currentModule = null;
    }

    start() {
        // Listen to hash changes
        window.addEventListener('hashchange', () => this.handleRouteChange());

        // Handle initial route
        this.handleRouteChange();
    }

    register(path, handler) {
        this.routes[path] = handler;
    }

    navigate(path) {
        window.location.hash = path;
    }

    handleRouteChange() {
        const hash = window.location.hash.slice(1) || '/dashboard';
        const route = hash.split('?')[0]; // Remove query params

        if (this.routes[route]) {
            this.currentRoute = route;

            // Cleanup previous module
            if (this.currentModule && this.currentModule.destroy) {
                this.currentModule.destroy();
            }

            // Load new module
            this.currentModule = this.routes[route]();
        } else {
            // Default to dashboard
            this.navigate('/dashboard');
        }
    }

    getCurrentRoute() {
        return this.currentRoute;
    }
}
