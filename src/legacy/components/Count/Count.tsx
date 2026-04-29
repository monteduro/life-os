import { useCounterStore } from '../../stores/counterStore'

function Count() {

  const { value, increment, decrement, reset } = useCounterStore()

  return (
    <div className="pb-4 flex flex-col gap-2">
      <h1>Count: {value}</h1>
      <div className="flex gap-2">
        <button className="bg-blue-500 text-white p-2 rounded-md" onClick={increment}>Increment</button>
        <button className="bg-red-500 text-white p-2 rounded-md" onClick={decrement}>Decrement</button>
        <button className="bg-gray-500 text-white p-2 rounded-md" onClick={reset}>Reset</button>
      </div>
    </div>
  )
}

export default Count
