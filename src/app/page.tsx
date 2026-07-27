"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  buildEqualSplits,
  calculateTripBalances,
  createSampleTrip,
  createTrip,
  formatMoney,
  parseTravelerNames,
  suggestSettlements,
  type ItineraryItem,
  type Trip,
} from "@/lib/trip-planner";

type TripFormState = {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelerNames: string;
};

type ItineraryFormState = {
  title: string;
  date: string;
  location: string;
  notes: string;
};

type ExpenseFormState = {
  title: string;
  category: string;
  amount: string;
  payerId: string;
  participantIds: string[];
  splitMode: "equal" | "manual";
  manualShares: Record<string, string>;
};

const emptyTripForm = (): TripFormState => ({
  name: "",
  destination: "",
  startDate: "",
  endDate: "",
  travelerNames: "",
});

const emptyItineraryForm = (): ItineraryFormState => ({
  title: "",
  date: "",
  location: "",
  notes: "",
});

const makeExpenseForm = (travelerIds: string[] = []): ExpenseFormState => ({
  title: "",
  category: "Food",
  amount: "",
  payerId: travelerIds[0] ?? "",
  participantIds: travelerIds,
  splitMode: "equal",
  manualShares: travelerIds.reduce<Record<string, string>>(
    (accumulator, travelerId) => {
      accumulator[travelerId] = "";
      return accumulator;
    },
    {},
  ),
});

export default function Home() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [tripForm, setTripForm] = useState<TripFormState>(emptyTripForm());
  const [itineraryForm, setItineraryForm] =
    useState<ItineraryFormState>(emptyItineraryForm());
  const [expenseForm, setExpenseForm] =
    useState<ExpenseFormState>(makeExpenseForm());
  const [message, setMessage] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadTrips() {
      try {
        const response = await fetch("/api/trips", {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load shared trips.");
        }

        const data = (await response.json()) as { trips: Trip[] };
        const loadedTrips = data.trips.length > 0 ? data.trips : [createSampleTrip()];
        const nextSelectedTrip = loadedTrips[0] ?? null;

        setTrips(loadedTrips);
        setSelectedTripId(nextSelectedTrip?.id ?? "");
        setItineraryForm(emptyItineraryForm());
        setExpenseForm(
          makeExpenseForm(nextSelectedTrip?.travelers.map((traveler) => traveler.id) ?? []),
        );
        hasLoadedRef.current = true;
      } catch {
        if (abortController.signal.aborted) {
          return;
        }

        const starterTrip = createSampleTrip();
        setTrips([starterTrip]);
        setSelectedTripId(starterTrip.id);
        setItineraryForm(emptyItineraryForm());
        setExpenseForm(makeExpenseForm(starterTrip.travelers.map((traveler) => traveler.id)));
        hasLoadedRef.current = true;
      }
    }

    void loadTrips();

    return () => {
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      return;
    }

    void fetch("/api/trips", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trips }),
    });
  }, [trips]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? trips[0] ?? null,
    [selectedTripId, trips],
  );

  const balances = useMemo(
    () => (selectedTrip ? calculateTripBalances(selectedTrip) : []),
    [selectedTrip],
  );
  const settlements = useMemo(
    () => (selectedTrip ? suggestSettlements(selectedTrip) : []),
    [selectedTrip],
  );
  const travelerLookup = useMemo(() => {
    const lookup = new Map<string, string>();

    selectedTrip?.travelers.forEach((traveler) => {
      lookup.set(traveler.id, traveler.name);
    });

    return lookup;
  }, [selectedTrip]);

  function resetFormsForTrip(trip: Trip | null) {
    setItineraryForm(emptyItineraryForm());
    setExpenseForm(
      makeExpenseForm(trip?.travelers.map((traveler) => traveler.id) ?? []),
    );
  }

  function updateSelectedTrip(updater: (trip: Trip) => Trip) {
    if (!selectedTrip) {
      return;
    }

    setTrips((currentTrips) =>
      currentTrips.map((trip) =>
        trip.id === selectedTrip.id ? updater(trip) : trip,
      ),
    );
  }

  function handleCreateTrip() {
    const travelers = parseTravelerNames(tripForm.travelerNames);

    if (
      !tripForm.name.trim() ||
      !tripForm.destination.trim() ||
      travelers.length === 0
    ) {
      setMessage("Add a trip name, a destination, and at least one traveler.");
      return;
    }

    const nextTrip = createTrip({
      name: tripForm.name,
      destination: tripForm.destination,
      startDate: tripForm.startDate,
      endDate: tripForm.endDate,
      travelers,
    });

    setTrips((currentTrips) => [nextTrip, ...currentTrips]);
    setSelectedTripId(nextTrip.id);
    resetFormsForTrip(nextTrip);
    setTripForm(emptyTripForm());
    setMessage(`Created ${nextTrip.name}.`);
  }

  function handleSelectTrip(trip: Trip) {
    setSelectedTripId(trip.id);
    resetFormsForTrip(trip);
  }

  function handleDeleteTrip(tripId: string) {
    setTrips((currentTrips) => {
      const remainingTrips = currentTrips.filter((trip) => trip.id !== tripId);
      const nextSelectedTrip = remainingTrips[0] ?? null;

      if (selectedTripId === tripId) {
        setSelectedTripId(nextSelectedTrip?.id ?? "");
        resetFormsForTrip(nextSelectedTrip);
      }

      return remainingTrips;
    });
  }

  function handleAddItineraryItem() {
    if (!selectedTrip || !itineraryForm.title.trim() || !itineraryForm.date) {
      setMessage("Add an itinerary title and date first.");
      return;
    }

    const nextItem: ItineraryItem = {
      id: crypto.randomUUID(),
      title: itineraryForm.title,
      date: itineraryForm.date,
      location: itineraryForm.location,
      notes: itineraryForm.notes,
    };

    updateSelectedTrip((trip) => ({
      ...trip,
      itinerary: [nextItem, ...trip.itinerary],
    }));
    setItineraryForm(emptyItineraryForm());
    setMessage("Added an itinerary item.");
  }

  function handleAddExpense() {
    if (!selectedTrip) {
      return;
    }

    const amount = Number.parseFloat(expenseForm.amount);
    const participants =
      expenseForm.participantIds.length > 0
        ? expenseForm.participantIds
        : selectedTrip.travelers.map((traveler) => traveler.id);

    if (!expenseForm.title.trim() || Number.isNaN(amount) || amount <= 0) {
      setExpenseError("Enter an expense name and a valid amount.");
      return;
    }

    if (!expenseForm.payerId) {
      setExpenseError("Choose who paid for this expense.");
      return;
    }

    if (participants.length === 0) {
      setExpenseError("Add at least one participant.");
      return;
    }

    if (expenseForm.splitMode === "equal") {
      updateSelectedTrip((trip) => ({
        ...trip,
        expenses: [
          {
            id: crypto.randomUUID(),
            title: expenseForm.title,
            category: expenseForm.category,
            amount,
            payerId: expenseForm.payerId,
            splitMode: "equal",
            participantIds: participants,
            splits: buildEqualSplits(amount, participants),
          },
          ...trip.expenses,
        ],
      }));

      setExpenseForm(
        makeExpenseForm(selectedTrip.travelers.map((traveler) => traveler.id)),
      );
      setExpenseError("");
      setMessage("Added a split expense.");
      return;
    }

    const manualShares = participants.map((travelerId) => {
      const share = Number.parseFloat(
        expenseForm.manualShares[travelerId] ?? "",
      );
      return { travelerId, share };
    });

    if (manualShares.some(({ share }) => Number.isNaN(share) || share < 0)) {
      setExpenseError("Enter a valid share for every participant.");
      return;
    }

    const shareTotal = manualShares.reduce((sum, { share }) => sum + share, 0);

    if (Math.abs(shareTotal - amount) > 0.01) {
      setExpenseError(`Manual shares must total ${formatMoney(amount)}.`);
      return;
    }

    updateSelectedTrip((trip) => ({
      ...trip,
      expenses: [
        {
          id: crypto.randomUUID(),
          title: expenseForm.title,
          category: expenseForm.category,
          amount,
          payerId: expenseForm.payerId,
          splitMode: "manual",
          participantIds: participants,
          splits: manualShares.map(({ travelerId, share }) => ({
            travelerId,
            amount: share,
          })),
        },
        ...trip.expenses,
      ],
    }));

    setExpenseForm(
      makeExpenseForm(selectedTrip.travelers.map((traveler) => traveler.id)),
    );
    setExpenseError("");
    setMessage("Added a manual-split expense.");
  }

  function handleDeleteExpense(expenseId: string) {
    updateSelectedTrip((trip) => ({
      ...trip,
      expenses: trip.expenses.filter((expense) => expense.id !== expenseId),
    }));
  }

  function handleDeleteItineraryItem(itemId: string) {
    updateSelectedTrip((trip) => ({
      ...trip,
      itinerary: trip.itinerary.filter((item) => item.id !== itemId),
    }));
  }

  const tripCount = trips.length;
  const travelerCount = selectedTrip?.travelers.length ?? 0;
  const itineraryCount = selectedTrip?.itinerary.length ?? 0;
  const expenseCount = selectedTrip?.expenses.length ?? 0;

  return (
    <main className="min-h-screen px-4 py-6 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-white/60 bg-stone-950 text-stone-50 shadow-[0_30px_80px_rgba(28,25,23,0.18)]">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-amber-300/30 bg-amber-200/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-100">
                Trip planner + shared spending
              </span>
              <div className="space-y-3">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  Plan the route, then settle the bill without friction.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
                  Build a trip, map out the days, add shared expenses, and get a
                  clear view of who paid, who owes, and what still needs to be
                  settled.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Trips" value={tripCount.toString()} />
                <StatCard label="Travelers" value={travelerCount.toString()} />
                <StatCard label="Stops" value={itineraryCount.toString()} />
                <StatCard label="Expenses" value={expenseCount.toString()} />
              </div>
              {message ? (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-100/10 px-4 py-3 text-sm text-amber-50">
                  {message}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 rounded-[1.6rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-stone-400">
                  Current trip
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {selectedTrip?.name ?? "No trip selected"}
                </h2>
                <p className="mt-1 text-sm text-stone-300">
                  {selectedTrip
                    ? `${selectedTrip.destination} · ${selectedTrip.startDate || "No start date"} to ${selectedTrip.endDate || "No end date"}`
                    : "Create a trip to start planning."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoTile
                  label="Balance view"
                  value={selectedTrip ? "Live" : "Waiting"}
                />
                <InfoTile label="Split mode" value="Equal + manual" />
                <InfoTile label="Storage" value="Shared database" />
                <InfoTile label="Mode" value="Live sync" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Panel title="Trips">
              <div className="space-y-3">
                {trips.map((trip) => (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => handleSelectTrip(trip)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      trip.id === selectedTripId
                        ? "border-amber-400 bg-amber-50 shadow-sm"
                        : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{trip.name}</h3>
                        <p className="mt-1 text-sm text-stone-600">
                          {trip.destination}
                        </p>
                      </div>
                      <span className="rounded-full bg-stone-900 px-2.5 py-1 text-xs text-stone-50">
                        {trip.travelers.length} travelers
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1">
                        {trip.startDate || "No start date"}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1">
                        {trip.endDate || "No end date"}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1">
                        {trip.expenses.length} expenses
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-3xl border border-stone-200 bg-stone-50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Create trip
                </h3>
                <div className="mt-4 grid gap-3">
                  <InputField
                    label="Trip name"
                    value={tripForm.name}
                    onChange={(value) =>
                      setTripForm((current) => ({ ...current, name: value }))
                    }
                    placeholder="Japan spring break"
                  />
                  <InputField
                    label="Destination"
                    value={tripForm.destination}
                    onChange={(value) =>
                      setTripForm((current) => ({
                        ...current,
                        destination: value,
                      }))
                    }
                    placeholder="Tokyo, Kyoto"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InputField
                      label="Start date"
                      type="date"
                      value={tripForm.startDate}
                      onChange={(value) =>
                        setTripForm((current) => ({
                          ...current,
                          startDate: value,
                        }))
                      }
                    />
                    <InputField
                      label="End date"
                      type="date"
                      value={tripForm.endDate}
                      onChange={(value) =>
                        setTripForm((current) => ({
                          ...current,
                          endDate: value,
                        }))
                      }
                    />
                  </div>
                  <InputField
                    label="Travelers"
                    value={tripForm.travelerNames}
                    onChange={(value) =>
                      setTripForm((current) => ({
                        ...current,
                        travelerNames: value,
                      }))
                    }
                    placeholder="Ava, Ben, Chris"
                    helperText="Separate names with commas."
                  />
                  <button
                    type="button"
                    onClick={handleCreateTrip}
                    className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
                  >
                    Add trip
                  </button>
                </div>
              </div>
            </Panel>

            <Panel title="Trip summary">
              {selectedTrip ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SummaryCard
                      label="Destination"
                      value={selectedTrip.destination}
                    />
                    <SummaryCard
                      label="Dates"
                      value={`${selectedTrip.startDate || "TBD"} to ${selectedTrip.endDate || "TBD"}`}
                    />
                    <SummaryCard
                      label="Travelers"
                      value={selectedTrip.travelers
                        .map((traveler) => traveler.name)
                        .join(", ")}
                    />
                    <SummaryCard
                      label="Trip budget"
                      value={formatMoney(
                        selectedTrip.expenses.reduce(
                          (sum, expense) => sum + expense.amount,
                          0,
                        ),
                      )}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedTrip.travelers.map((traveler) => (
                      <span
                        key={traveler.id}
                        className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700"
                      >
                        {traveler.name}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTrip(selectedTrip.id)}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    Delete current trip
                  </button>
                </div>
              ) : (
                <EmptyState
                  title="No trip selected"
                  description="Create a trip to begin planning itineraries and splitting expenses."
                />
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Itinerary">
              {selectedTrip ? (
                <div className="space-y-5">
                  <div className="grid gap-3 rounded-3xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
                    <InputField
                      label="Activity"
                      value={itineraryForm.title}
                      onChange={(value) =>
                        setItineraryForm((current) => ({
                          ...current,
                          title: value,
                        }))
                      }
                      placeholder="Senso-ji and Asakusa walk"
                    />
                    <InputField
                      label="Date"
                      type="date"
                      value={itineraryForm.date}
                      onChange={(value) =>
                        setItineraryForm((current) => ({
                          ...current,
                          date: value,
                        }))
                      }
                    />
                    <InputField
                      label="Location"
                      value={itineraryForm.location}
                      onChange={(value) =>
                        setItineraryForm((current) => ({
                          ...current,
                          location: value,
                        }))
                      }
                      placeholder="Tokyo"
                    />
                    <InputField
                      label="Notes"
                      value={itineraryForm.notes}
                      onChange={(value) =>
                        setItineraryForm((current) => ({
                          ...current,
                          notes: value,
                        }))
                      }
                      placeholder="Book lunch in advance"
                    />
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddItineraryItem}
                        className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-600"
                      >
                        Add itinerary item
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedTrip.itinerary.length === 0 ? (
                      <EmptyState
                        title="No itinerary items yet"
                        description="Add places, activities, or reminders for the trip schedule."
                      />
                    ) : (
                      selectedTrip.itinerary.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium uppercase tracking-[0.18em] text-stone-500">
                                {item.date}
                              </p>
                              <h3 className="mt-1 text-lg font-semibold">
                                {item.title}
                              </h3>
                              <p className="mt-1 text-sm text-stone-600">
                                {item.location || "No location"}
                              </p>
                              {item.notes ? (
                                <p className="mt-2 text-sm text-stone-700">
                                  {item.notes}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteItineraryItem(item.id)}
                              className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Choose a trip"
                  description="Itinerary items appear here once a trip is selected."
                />
              )}
            </Panel>

            <Panel title="Spending">
              {selectedTrip ? (
                <div className="space-y-5">
                  <div className="grid gap-3 rounded-3xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
                    <InputField
                      label="Expense name"
                      value={expenseForm.title}
                      onChange={(value) => {
                        setExpenseForm((current) => ({
                          ...current,
                          title: value,
                        }));
                        setExpenseError("");
                      }}
                      placeholder="Dinner at the harbor"
                    />
                    <InputField
                      label="Category"
                      value={expenseForm.category}
                      onChange={(value) =>
                        setExpenseForm((current) => ({
                          ...current,
                          category: value,
                        }))
                      }
                      placeholder="Food, transport, stay"
                    />
                    <InputField
                      label="Amount"
                      type="number"
                      value={expenseForm.amount}
                      onChange={(value) => {
                        setExpenseForm((current) => ({
                          ...current,
                          amount: value,
                        }));
                        setExpenseError("");
                      }}
                      placeholder="120.00"
                    />
                    <SelectField
                      label="Paid by"
                      value={expenseForm.payerId}
                      onChange={(value) =>
                        setExpenseForm((current) => ({
                          ...current,
                          payerId: value,
                        }))
                      }
                      options={selectedTrip.travelers.map((traveler) => ({
                        value: traveler.id,
                        label: traveler.name,
                      }))}
                    />
                    <SelectField
                      label="Split mode"
                      value={expenseForm.splitMode}
                      onChange={(value) =>
                        setExpenseForm((current) => ({
                          ...current,
                          splitMode: value as ExpenseFormState["splitMode"],
                        }))
                      }
                      options={[
                        { value: "equal", label: "Equal split" },
                        { value: "manual", label: "Manual split" },
                      ]}
                    />
                    <div className="sm:col-span-2">
                      <p className="text-sm font-medium text-stone-700">
                        Participants
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedTrip.travelers.map((traveler) => {
                          const checked = expenseForm.participantIds.includes(
                            traveler.id,
                          );

                          return (
                            <label
                              key={traveler.id}
                              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                                checked
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                                  : "border-stone-200 bg-white text-stone-600"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  const isChecked = event.target.checked;

                                  setExpenseForm((current) => {
                                    const nextParticipants = isChecked
                                      ? [...current.participantIds, traveler.id]
                                      : current.participantIds.filter(
                                          (participantId) =>
                                            participantId !== traveler.id,
                                        );

                                    return {
                                      ...current,
                                      participantIds: nextParticipants,
                                      manualShares: isChecked
                                        ? {
                                            ...current.manualShares,
                                            [traveler.id]:
                                              current.manualShares[
                                                traveler.id
                                              ] ?? "",
                                          }
                                        : Object.fromEntries(
                                            Object.entries(
                                              current.manualShares,
                                            ).filter(
                                              ([participantId]) =>
                                                participantId !== traveler.id,
                                            ),
                                          ),
                                    };
                                  });
                                }}
                              />
                              {traveler.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {expenseForm.splitMode === "manual" ? (
                      <div className="sm:col-span-2 grid gap-3 rounded-3xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
                        {selectedTrip.travelers
                          .filter((traveler) =>
                            expenseForm.participantIds.includes(traveler.id),
                          )
                          .map((traveler) => (
                            <InputField
                              key={traveler.id}
                              label={`${traveler.name}'s share`}
                              type="number"
                              value={
                                expenseForm.manualShares[traveler.id] ?? ""
                              }
                              onChange={(value) =>
                                setExpenseForm((current) => ({
                                  ...current,
                                  manualShares: {
                                    ...current.manualShares,
                                    [traveler.id]: value,
                                  },
                                }))
                              }
                              placeholder="40.00"
                            />
                          ))}
                      </div>
                    ) : null}

                    <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleAddExpense}
                        className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
                      >
                        Add expense
                      </button>
                      {expenseError ? (
                        <span className="text-sm text-rose-600">
                          {expenseError}
                        </span>
                      ) : (
                        <span className="text-sm text-stone-500">
                          Equal split is the default.
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-3">
                      {selectedTrip.expenses.length === 0 ? (
                        <EmptyState
                          title="No expenses yet"
                          description="Add shared costs for hotels, transit, meals, or activities."
                        />
                      ) : (
                        selectedTrip.expenses.map((expense) => (
                          <article
                            key={expense.id}
                            className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-stone-500">
                                  <span className="rounded-full bg-stone-100 px-2.5 py-1">
                                    {expense.category}
                                  </span>
                                  <span className="rounded-full bg-stone-100 px-2.5 py-1">
                                    {expense.splitMode === "equal"
                                      ? "Equal split"
                                      : "Manual split"}
                                  </span>
                                </div>
                                <h3 className="mt-3 text-lg font-semibold">
                                  {expense.title}
                                </h3>
                                <p className="mt-1 text-sm text-stone-600">
                                  {formatMoney(expense.amount)} paid by{" "}
                                  {travelerLookup.get(expense.payerId) ??
                                    "Unknown"}
                                </p>
                                <p className="mt-2 text-sm text-stone-700">
                                  Split among{" "}
                                  {expense.participantIds
                                    .map(
                                      (travelerId) =>
                                        travelerLookup.get(travelerId) ??
                                        "Unknown",
                                    )
                                    .join(", ")}
                                </p>
                                <p className="mt-2 text-sm text-stone-500">
                                  {expense.splits
                                    .map(
                                      (split) =>
                                        `${travelerLookup.get(split.travelerId) ?? "Unknown"}: ${formatMoney(split.amount)}`,
                                    )
                                    .join(" · ")}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="rounded-full border border-stone-200 px-3 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                              >
                                Remove
                              </button>
                            </div>
                          </article>
                        ))
                      )}
                    </div>

                    <div className="space-y-4 rounded-3xl border border-stone-200 bg-stone-50 p-4">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">
                        Balance summary
                      </h3>
                      <div className="space-y-3">
                        {balances.map((balance) => (
                          <div
                            key={balance.travelerId}
                            className="rounded-2xl border border-stone-200 bg-white px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">{balance.name}</p>
                                <p className="text-sm text-stone-500">
                                  Paid {formatMoney(balance.paid)} · Owes{" "}
                                  {formatMoney(balance.owed)}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                                  balance.net >= 0
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-rose-100 text-rose-700"
                                }`}
                              >
                                {balance.net >= 0 ? "+" : "-"}
                                {formatMoney(Math.abs(balance.net))}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-4">
                        <h4 className="text-sm font-semibold text-stone-800">
                          Suggested settlements
                        </h4>
                        {settlements.length === 0 ? (
                          <p className="mt-2 text-sm text-stone-500">
                            Everyone is settled up.
                          </p>
                        ) : (
                          <ul className="mt-3 space-y-2 text-sm text-stone-700">
                            {settlements.map((settlement, index) => (
                              <li
                                key={`${settlement.fromId}-${settlement.toId}-${index}`}
                              >
                                {settlement.fromName} pays {settlement.toName}{" "}
                                {formatMoney(settlement.amount)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Choose a trip"
                  description="Expense tracking appears here once a trip is selected."
                />
              )}
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/85 p-5 shadow-[0_20px_50px_rgba(28,25,23,0.08)] backdrop-blur">
      <div className="mb-5 flex items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-stone-50">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-stone-900">{value}</p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-5 py-8 text-center">
      <h3 className="text-base font-semibold text-stone-800">{title}</h3>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  helperText?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
      />
      {helperText ? (
        <span className="text-xs font-normal text-stone-500">{helperText}</span>
      ) : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-stone-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
