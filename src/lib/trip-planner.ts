export const localStorageKey = "trip-planner:state:v1";

export type Traveler = {
  id: string;
  name: string;
};

export type ItineraryItem = {
  id: string;
  title: string;
  date: string;
  location: string;
  notes: string;
};

export type ExpenseSplit = {
  travelerId: string;
  amount: number;
};

export type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number;
  payerId: string;
  splitMode: "equal" | "manual";
  participantIds: string[];
  splits: ExpenseSplit[];
};

export type Trip = {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: Traveler[];
  itinerary: ItineraryItem[];
  expenses: Expense[];
};

type Balance = {
  travelerId: string;
  name: string;
  paid: number;
  owed: number;
  net: number;
};

type Settlement = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
};

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function fromCents(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseTravelerNames(rawValue: string) {
  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((name) => ({ id: crypto.randomUUID(), name }));
}

export function createTrip(input: {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: Traveler[];
  itinerary?: ItineraryItem[];
  expenses?: Expense[];
}): Trip {
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    destination: input.destination.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers,
    itinerary: input.itinerary ?? [],
    expenses: input.expenses ?? [],
  };
}

export function buildEqualSplits(amount: number, participantIds: string[]) {
  if (participantIds.length === 0) {
    return [];
  }

  const amountInCents = toCents(amount);
  const baseShare = Math.floor(amountInCents / participantIds.length);
  const remainder = amountInCents % participantIds.length;

  return participantIds.map((travelerId, index) => ({
    travelerId,
    amount: fromCents(baseShare + (index < remainder ? 1 : 0)),
  }));
}

export function createSampleTrip() {
  const travelers = [
    { id: crypto.randomUUID(), name: "Ava" },
    { id: crypto.randomUUID(), name: "Ben" },
    { id: crypto.randomUUID(), name: "Chris" },
  ];

  const itinerary: ItineraryItem[] = [
    {
      id: crypto.randomUUID(),
      title: "Arrive and check in",
      date: "2026-09-12",
      location: "Tokyo",
      notes: "Drop bags, then head out for dinner.",
    },
  ];

  const dinnerAmount = 96;

  const expenses: Expense[] = [
    {
      id: crypto.randomUUID(),
      title: "Welcome dinner",
      category: "Food",
      amount: dinnerAmount,
      payerId: travelers[0].id,
      splitMode: "equal",
      participantIds: travelers.map((traveler) => traveler.id),
      splits: buildEqualSplits(
        dinnerAmount,
        travelers.map((traveler) => traveler.id),
      ),
    },
  ];

  return createTrip({
    name: "Tokyo kickoff",
    destination: "Tokyo, Japan",
    startDate: "2026-09-12",
    endDate: "2026-09-18",
    travelers,
    itinerary,
    expenses,
  });
}

export function calculateTripBalances(trip: Trip): Balance[] {
  const balanceByTraveler = new Map<string, { paid: number; owed: number }>();

  trip.travelers.forEach((traveler) => {
    balanceByTraveler.set(traveler.id, { paid: 0, owed: 0 });
  });

  trip.expenses.forEach((expense) => {
    const payerBalance = balanceByTraveler.get(expense.payerId);

    if (payerBalance) {
      payerBalance.paid += expense.amount;
    }

    expense.splits.forEach((split) => {
      const splitBalance = balanceByTraveler.get(split.travelerId);

      if (splitBalance) {
        splitBalance.owed += split.amount;
      }
    });
  });

  return trip.travelers.map((traveler) => {
    const current = balanceByTraveler.get(traveler.id) ?? { paid: 0, owed: 0 };

    return {
      travelerId: traveler.id,
      name: traveler.name,
      paid: Number(current.paid.toFixed(2)),
      owed: Number(current.owed.toFixed(2)),
      net: Number((current.paid - current.owed).toFixed(2)),
    };
  });
}

export function suggestSettlements(trip: Trip): Settlement[] {
  const balances = calculateTripBalances(trip);
  const creditors = balances
    .filter((balance) => balance.net > 0)
    .map((balance) => ({ ...balance, cents: toCents(balance.net) }));
  const debtors = balances
    .filter((balance) => balance.net < 0)
    .map((balance) => ({ ...balance, cents: toCents(Math.abs(balance.net)) }));

  const settlements: Settlement[] = [];

  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const transferInCents = Math.min(creditor.cents, debtor.cents);

    settlements.push({
      fromId: debtor.travelerId,
      fromName: debtor.name,
      toId: creditor.travelerId,
      toName: creditor.name,
      amount: fromCents(transferInCents),
    });

    creditor.cents -= transferInCents;
    debtor.cents -= transferInCents;

    if (creditor.cents === 0) {
      creditorIndex += 1;
    }

    if (debtor.cents === 0) {
      debtorIndex += 1;
    }
  }

  return settlements;
}
