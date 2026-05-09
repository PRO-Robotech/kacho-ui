// MoveStubDialog — заглушка для Move-actions per resource (kebab menu).
//
// На текущей итерации UI не реализует выбор целевого folder/cloud — это
// требует Org/Cloud/Folder picker (отдельная задача). Move-RPC
// существует на бэкенде (POST /<api>/<id>:move{destination_folder_id}).

import { Info } from "lucide-react";
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

export function MoveStubDialog({ open, onOpenChange, resourceLabel, name, apiPath }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-400" />
            Перемещение через UI пока не реализовано
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              <span className="text-muted-foreground">{resourceLabel}: </span>
              <span className="font-medium text-foreground">{name}</span>
            </span>
            <span className="block text-xs text-muted-foreground">
              UI пока не имеет picker'а целевого Folder/Cloud. Используйте
              REST API:
            </span>
            <code className="block rounded bg-muted px-2 py-1 text-xs font-mono break-all">
              POST {apiPath}:move
              {"\n"}
              {"{ "}destination_folder_id: "&lt;folder-id&gt;"{" }"}
            </code>
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
