import { Head } from "../../src/index.ts";
import Counter from "../components/Counter.island.tsx";

export default function CounterPage() {
  return (
    <>
      <Head>
        <title>Counter — Islands Demo</title>
      </Head>
      <h1>Islands Demo</h1>
      <p>The counter below is a client-side island — hydrated in the browser.</p>
      <Counter initial={0} />
      <p>This text is server-rendered and never changes on the client.</p>
    </>
  );
}
