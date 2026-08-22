export const harnessState = {
  base44Calls: [],
  result: null,
};

export function resetHarnessState() {
  harnessState.base44Calls.length = 0;
  harnessState.result = null;
}
