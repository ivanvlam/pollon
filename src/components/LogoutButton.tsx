import { logout } from "@/app/(auth)/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="text-sm text-neutral-400 underline transition hover:text-white"
      >
        Salir
      </button>
    </form>
  );
}
