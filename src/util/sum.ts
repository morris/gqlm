export function sum(array: number[]) {
  let s = 0;

  for (let i = 0, l = array.length; i < l; ++i) {
    s += array[i];
  }

  return s;
}
