import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceLabel: string;
  name: string;
  apiPath: string;
}

export function DeleteConfirmStub({ open, onOpenChange, resourceLabel, name, apiPath }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Удаление через UI отключено
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              <span className="text-muted-foreground">{resourceLabel}: </span>
              <span className="font-medium text-foreground">{name}</span>
            </span>
            <span className="block text-xs text-muted-foreground">
              На текущей итерации UI не выполняет destructive-операции.
              Удаляйте через REST API:
            </span>
            <code className="block rounded bg-muted px-2 py-1 text-xs font-mono break-all">
              DELETE {apiPath}
            </code>
            <span className="block text-xs text-muted-foreground">
              или через <code>kachoctl</code>.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Понятно
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
