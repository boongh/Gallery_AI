import { createTheme, MantineColorsTuple } from "@mantine/core";


const myColor: MantineColorsTuple = [
  '#f5f5f5',
  '#e7e7e7',
  '#cdcdcd',
  '#b2b2b2',
  '#9a9a9a',
  '#8b8b8b',
  '#848484',
  '#717171',
  '#656565',
  '#171717'
];

export const theme = createTheme({
  /* Put your mantine theme override here */
  colors:{
    myColor,
  },
});