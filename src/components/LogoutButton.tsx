import { Button } from "@/components/ui/Button";
import { logout } from "@/app/(auth)/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm">
        Salir
      </Button>
    </form>
  );
}
