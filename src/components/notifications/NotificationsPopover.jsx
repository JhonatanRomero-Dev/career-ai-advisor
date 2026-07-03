import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Briefcase, CheckCheck, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

function formatNotificationDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function NotificationsPopover() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const previousUnreadCount = useRef(null);

  const { data = { notifications: [], unread_count: 0 }, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => base44.notifications.list(20),
    refetchInterval: 30000,
  });

  const notifications = data.notifications || [];
  const unreadCount = Number(data.unread_count || 0);

  useEffect(() => {
    if (previousUnreadCount.current === null) {
      previousUnreadCount.current = unreadCount;
      return;
    }

    if (unreadCount > previousUnreadCount.current) {
      toast("Novas vagas compatíveis encontradas", {
        description: "Abra as notificações para ver as oportunidades.",
      });
    }

    previousUnreadCount.current = unreadCount;
  }, [unreadCount]);

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.notifications.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => base44.notifications.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const openNotification = async (notification) => {
    if (!notification.read_at) {
      await markAsReadMutation.mutateAsync(notification.id);
    }

    navigate("/jobs");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Notificações</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? "s" : ""}` : "Tudo em dia"}
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              <CheckCheck className="h-4 w-4" />
              Marcar lidas
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Nenhuma notificação</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Novas vagas compatíveis aparecem aqui.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px]">
            <div className="p-2">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className="flex w-full gap-3 rounded-md p-3 text-left transition-colors hover:bg-accent"
                >
                  <span className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Briefcase className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {notification.title}
                      </span>
                      {!notification.read_at && (
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                      )}
                    </span>

                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {notification.message}
                    </span>

                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {notification.top_match}% match
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatNotificationDate(notification.created_date)}
                      </span>
                    </span>
                  </span>

                  <ChevronRight className="mt-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
