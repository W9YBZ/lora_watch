import { assign, createActor, createMachine } from "xstate";
import type { HomeCardId, ScreenId } from "./protocol";
import { HOME_CARDS } from "./protocol";

export interface MenuContext {
  selectedCardIndex: number;
  trackingActive: boolean;
}

export type MenuInputEvent =
  | { type: "wake" }
  | { type: "back" }
  | { type: "confirm"; longPress?: boolean }
  | { type: "touch.tap" }
  | { type: "touch.swipe_up" }
  | { type: "touch.swipe_down" }
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
        wake: {
          target: "Home"
        }
      }
    },
    Home: {
      on: {
        "touch.swipe_up": {
          actions: assign({
            selectedCardIndex: ({ context }) => (context.selectedCardIndex + 1) % HOME_CARDS.length
          })
        },
        "touch.swipe_down": {
          actions: assign({
            selectedCardIndex: ({ context }) =>
              (context.selectedCardIndex - 1 + HOME_CARDS.length) % HOME_CARDS.length
          })
        },
        confirm: [
          {
            guard: ({ event }) => event.type === "confirm" && event.longPress === true,
            actions: assign({
              trackingActive: ({ context }) => !context.trackingActive
            })
          },
          ...routeToSelectedCard
        ],
        "touch.tap": routeToSelectedCard,
        timeout: {
          target: "Boot"
        }
      }
    },
    Tracking: {
      on: {
        back: {
          target: "Home"
        },
        confirm: {
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
        back: {
          target: "Home"
        },
        timeout: {
          target: "Boot"
        }
      }
    },
    RadioStatus: {
      on: {
        back: {
          target: "Home"
        },
        timeout: {
          target: "Boot"
        }
      }
    },
    Settings: {
      on: {
        back: {
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
    // Bring the actor in sync with a non-default card by replaying swipes.
    for (let index = 0; index < (initialContext?.selectedCardIndex ?? 0); index += 1) {
      actor.send({ type: "touch.swipe_up" });
    }
  }

  if (initialContext?.trackingActive) {
    actor.send({ type: "wake" });
    actor.send({ type: "confirm", longPress: true });
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
