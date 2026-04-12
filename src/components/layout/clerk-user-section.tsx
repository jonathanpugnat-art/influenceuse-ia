"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import {
  LogOut,
  User as UserIcon,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ClerkUserSection({
  isCollapsed,
}: {
  isCollapsed: boolean;
}) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const avatarUrl = user?.imageUrl;
  const name = user?.fullName ?? user?.firstName ?? "Utilisateur";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const avatar = (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-500">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-medium text-white">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );

  if (isCollapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center justify-center rounded-xl px-3 py-2 transition-colors hover:bg-slate-800/50">
            {avatar}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="end"
          className="w-56 border-slate-800 bg-slate-900"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-white">{name}</p>
            <p className="truncate text-xs text-slate-400">{email}</p>
          </div>
          <DropdownMenuSeparator className="bg-slate-800" />
          <DropdownMenuItem className="text-slate-300 focus:bg-slate-800 focus:text-white">
            <UserIcon className="mr-2 h-4 w-4" />
            Mon profil
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => signOut()}
            className="text-slate-300 focus:bg-slate-800 focus:text-white"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-800/50">
          {avatar}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{name}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        className="w-56 border-slate-800 bg-slate-900"
      >
        <DropdownMenuItem className="text-slate-300 focus:bg-slate-800 focus:text-white">
          <UserIcon className="mr-2 h-4 w-4" />
          Mon profil
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-800" />
        <DropdownMenuItem
          onClick={() => signOut()}
          className="text-slate-300 focus:bg-slate-800 focus:text-white"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

