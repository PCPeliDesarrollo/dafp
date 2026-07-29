import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode; title?: string };
type State = { error: Error | null };

/** Evita que un fallo en una sección tumbe todo el dashboard. */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("SectionErrorBoundary", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div className="flex-1">
              <p className="font-medium">{this.props.title ?? "Se produjo un error en esta sección"}</p>
              <p className="mt-1 text-xs opacity-80">{this.state.error.message}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => this.setState({ error: null })}
              >
                Reintentar
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
