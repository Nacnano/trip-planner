import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSampleTrip, type Trip } from "@/lib/trip-planner";

const sharedSnapshotId = "shared";

async function getSharedTrips(): Promise<Trip[]> {
  const snapshot = await prisma.appSnapshot.findUnique({
    where: { id: sharedSnapshotId },
  });

  if (snapshot) {
    return snapshot.trips as Trip[];
  }

  const starterTrips = [createSampleTrip()];

  await prisma.appSnapshot.create({
    data: {
      id: sharedSnapshotId,
      trips: starterTrips,
    },
  });

  return starterTrips;
}

export async function GET() {
  const trips = await getSharedTrips();

  return NextResponse.json({ trips });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { trips?: Trip[] };

  if (!Array.isArray(body.trips)) {
    return NextResponse.json(
      { error: "Expected a trips array." },
      { status: 400 },
    );
  }

  const snapshot = await prisma.appSnapshot.upsert({
    where: { id: sharedSnapshotId },
    create: {
      id: sharedSnapshotId,
      trips: body.trips,
    },
    update: {
      trips: body.trips,
    },
  });

  return NextResponse.json({ trips: snapshot.trips });
}
