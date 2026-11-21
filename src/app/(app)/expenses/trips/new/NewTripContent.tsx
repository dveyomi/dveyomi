import { redirect } from "next/navigation";
import { NewTripForm } from "@/components/TripEditor";
import { getUserId } from "@/lib/supabase/server";
import { getToday } from "@/lib/today";
import { isIsoDate } from "@/lib/validation/expense";
import { MAX_PLACE_LENGTH } from "@/lib/validation/trip";

type Param = string | string[] | undefined;
type Params = { place?: Param; start?: Param; end?: Param };

/** New trip: ?place=, ?start= and ?end= (from "Start a trip?") fill the form; otherwise it starts today. */
export async function NewTripContent({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await getUserId())) redirect("/login");
  const [today, params] = await Promise.all([getToday(), searchParams]);
  const text = (v: Param) => (typeof v === "string" ? v : "");
  const date = (v: Param) => (isIsoDate(v) ? v : today);
  return (
    <NewTripForm
      initial={{
        name: "",
        place: text(params.place).slice(0, MAX_PLACE_LENGTH),
        startDate: date(params.start),
        endDate: date(params.end),
      }}
    />
  );
}
