import { Button } from "./Button";
import { LegacyButton } from "./LegacyButton";

export default {
  title: "Buttons",
};

export const Primary = {
  render: () => <Button>Save</Button>,
};

export const Legacy = {
  render: () => <LegacyButton>Save</LegacyButton>,
};
