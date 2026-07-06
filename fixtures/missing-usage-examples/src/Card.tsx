export type CardProps = {
  title: string;
};

export function Card(props: CardProps) {
  return <section>{props.title}</section>;
}
