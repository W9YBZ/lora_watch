import { assign, createActor, createMachine } from "xstate";
import type { HomeCardId, ScreenId } from "./protocol";
import { HOME_CARDS } from "./protocol";

export interface MenuContext {
  selectedCardIndex: number;
  trackingActive: boolean;
}

export type MenuInputEvent =
  | { type: "m"; longPress?: boolean }
  | { type: "exit" }
  | { type: "up" }
  | { type: "down" }
  | { type: "timeout" };

export interface MenuSnapshot {
  screen: ScreenId;
  selectedCard: HomeCardId;
  trackingActive: boolean;
}

const routeToSelectedCard = [
  { guard: ({ context }: { context: MenuContext }) => context.selectedCardIndex === 0, target: "Tracking" },
  {
    guard: ({ context }: { context: MenuContext }) => context.selectedCardIndex === 1,
    target: "LocationDetail"
  },
  { guard: ({ context }: { context: MenuContext }) => context.selectedCardIndex === 2, target: "RadioStatus" },
  { target: "Settings" }
] as const;

export const MenuMachine = createMachine({
  id: "menu",
  types: {} as {
    context: MenuContext;
    events: MenuInputEvent;
  },
  context: {
    selectedCardIndex: 0,
    trackingActive: false
  },
  initial: "Boot",
  states: {
    Boot: {
      on: {
        m: {
          target: "Home"
        },
        exit: {
          target: "Home"
        },
        up: {
          target: "Home"
        },
        down: {
          target: "Home"
        }
      }
    },
    Home: {
      on: {
        up: {
          actions: assign({
            selectedCardIndex: ({ context }) =>
              (context.selectedCardIndex - 1 + HOME_CARDS.length) % HOME_CARDS.length
          })
        },
        down: {
          actions: assign({
            selectedCardIndex: ({ context }) => (context.selectedCardIndex + 1) % HOME_CARDS.length
          })
        },
        m: [
          {
            guard: ({ event }) => event.type === "m" && event.longPress === true,
            actions: assign({
              trackingActive: ({ context }) => !context.trackingActive
            })
          },
          ...routeToSelectedCard
        ],
        exit: {
          target: "Boot"
        },
        timeout: {
          target: "Boot"
        }
      }
    },
    Tracking: {
      on: {
        exit: {
          target: "Home"
        },
        m: {
          actions: assign({
            trackingActive: ({ context }) => !context.trackingActive
          })
        },
        timeout: {
          target: "Boot"
        }
      }
    },
    LocationDetail: {
      on: {
        exit: {
          target: "Home"
        },
        timeout: {
          target: "Boot"
        }
      }
    },
    RadioStatus: {
      on: {
        exit: {
          target: "Home"
        },
        timeout: {
          target: "Boot"
        }
      }
    },
    Settings: {
      on: {
        exit: {
          target: "Home"
        },
        timeout: {
          target: "Boot"
        }
      }
    }
  }
});

export function createStartedMenuActor(initialContext?: Partial<MenuContext>) {
  const actor = createActor(MenuMachine);

  actor.start();

  if ((initialContext?.selectedCardIndex ?? 0) > 0) {
    // Bring the actor in sync with a non-default card by replaying DOWN presses.
    for (let index = 0; index < (initialContext?.selectedCardIndex ?? 0); index += 1) {
      actor.send({ type: "down" });
    }
  }

  if (initialContext?.trackingActive) {
    actor.send({ type: "m" });
    actor.send({ type: "m", longPress: true });
  }

  return actor;
}

export function snapshotMenu(actor: ReturnType<typeof createStartedMenuActor>): MenuSnapshot {
  const snapshot = actor.getSnapshot();
  return {
    screen: snapshot.value as ScreenId,
    selectedCard: HOME_CARDS[snapshot.context.selectedCardIndex] ?? HOME_CARDS[0],
    trackingActive: snapshot.context.trackingActive
  };
}
