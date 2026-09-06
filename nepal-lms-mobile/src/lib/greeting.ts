/** A static "Hi, {name}" never changes across a whole day of opening the app — this reads the clock once per render instead. */
export function timeOfDayGreeting(firstName?: string): string {
  const hour = new Date().getHours();
  const time = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return firstName ? `Good ${time}, ${firstName}` : `Good ${time}`;
}
