import type { LabStep } from "@shared/schema";

export const LAB_PRESETS = [
  {
    id: "led-circuit",
    name: "Basic LED Circuit",
    description: "Build a simple LED circuit with a current-limiting resistor on a breadboard.",
    difficulty: "Beginner",
    duration: "15 min",
    components: ["Breadboard", "LED (any color)", "1kΩ Resistor", "Jumper wires", "5V power supply"],
  },
  {
    id: "voltage-divider",
    name: "Voltage Divider",
    description: "Construct a voltage divider using two resistors to step down voltage.",
    difficulty: "Beginner",
    duration: "20 min",
    components: ["Breadboard", "10kΩ Resistor (×2)", "Multimeter", "Jumper wires", "9V battery"],
  },
  {
    id: "555-blink",
    name: "555 Timer LED Blinker",
    description: "Use a 555 timer IC in astable mode to blink an LED at ~1Hz.",
    difficulty: "Intermediate",
    duration: "30 min",
    components: ["Breadboard", "555 Timer IC", "LED", "1kΩ + 10kΩ Resistors", "10μF Capacitor", "Jumper wires"],
  },
];

export function getLabSteps(labId: string): LabStep[] {
  switch (labId) {
    case "led-circuit":
      return [
        {
          id: 1,
          title: "Set up the breadboard",
          description: "Place your breadboard on a flat surface. Identify the power rails (marked + and −) running along each long edge. These are the VCC and GND buses.",
          hint: "The red (+) rail is VCC. The blue (−) rail is GND. Make sure you can see both edges of the board.",
          components: ["Breadboard"],
          completed: false,
          active: true,
          errorCheck: "Breadboard not detected. Point camera at your workspace.",
        },
        {
          id: 2,
          title: "Connect power rails",
          description: "Use a red jumper wire to connect your 5V power source to the + rail. Use a black jumper wire to connect GND to the − rail.",
          hint: "Convention: Red = VCC/5V, Black = GND. Always follow color convention — it prevents wiring mistakes later.",
          components: ["Red jumper wire", "Black jumper wire"],
          completed: false,
          active: false,
        },
        {
          id: 3,
          title: "Place the resistor",
          description: "Insert a 1kΩ resistor (Brown-Black-Red-Gold bands) across the center divider. One leg in column E, one leg in column F — same row number, e.g. E10 to F10.",
          hint: "The 4-band code Brown-Black-Red = 1000Ω = 1kΩ. The Gold band is the tolerance (±5%). This resistor protects the LED from excess current.",
          components: ["1kΩ Resistor"],
          completed: false,
          active: false,
          errorCheck: "Resistor not detected. Check that it spans the center gap.",
        },
        {
          id: 4,
          title: "Insert the LED",
          description: "Insert the LED in the same column as one leg of the resistor. Longer leg (anode/+) toward the resistor, shorter leg (cathode/−) toward GND.",
          hint: "Never connect an LED directly to power without a resistor — it will burn out instantly. Formula: R = (Vsupply − Vf) / If = (5 − 2) / 0.02 = 150Ω minimum.",
          components: ["LED"],
          completed: false,
          active: false,
          errorCheck: "LED not detected or may be reversed. Check polarity.",
        },
        {
          id: 5,
          title: "Wire to GND",
          description: "Connect the LED cathode (short leg side) to the − GND rail using a jumper wire. Connect the resistor's other leg to the + VCC rail.",
          hint: "Circuit path: VCC → Resistor → LED → GND. Current flows through every element in series.",
          components: ["Jumper wires"],
          completed: false,
          active: false,
        },
        {
          id: 6,
          title: "Power on and test",
          description: "Apply 5V to the VCC rail. The LED should light up. If it doesn't: check polarity, check connections, check power supply voltage.",
          hint: "If the LED is dim, your resistor value is high — try 470Ω. If it flickers, check for loose connections. If nothing lights up, trace the circuit from VCC to GND.",
          components: [],
          completed: false,
          active: false,
        },
      ];

    case "voltage-divider":
      return [
        {
          id: 1,
          title: "Understand the concept",
          description: "A voltage divider uses two resistors in series to output a fraction of the input voltage. Vout = Vin × R2 / (R1 + R2).",
          hint: "For two equal 10kΩ resistors: Vout = 9V × 10k / (10k + 10k) = 4.5V — exactly half.",
          components: ["Breadboard"],
          completed: false,
          active: true,
        },
        {
          id: 2,
          title: "Place R1 (10kΩ)",
          description: "Insert the first 10kΩ resistor (Brown-Black-Orange) vertically in the breadboard. One end connects to the VCC rail.",
          hint: "Brown-Black-Orange-Gold = 10,000Ω = 10kΩ",
          components: ["10kΩ Resistor"],
          completed: false,
          active: false,
        },
        {
          id: 3,
          title: "Place R2 (10kΩ)",
          description: "Insert the second 10kΩ resistor so it connects from the output node (junction of R1) down to GND.",
          hint: "The mid-point between R1 and R2 is your output node. This is where you measure Vout.",
          components: ["10kΩ Resistor"],
          completed: false,
          active: false,
        },
        {
          id: 4,
          title: "Connect power and measure",
          description: "Connect 9V battery. Set multimeter to DC voltage. Measure between the mid-point and GND. You should read ~4.5V.",
          hint: "Multimeter tip: always connect the COM (black) probe to GND first, then the positive (red) probe to the measurement point.",
          components: ["Multimeter", "Jumper wires"],
          completed: false,
          active: false,
        },
      ];

    case "555-blink":
      return [
        {
          id: 1,
          title: "Orient the 555 IC",
          description: "Place the 555 timer IC across the center divider. The notch or dot marks pin 1 (GND). Pin numbers run counter-clockwise.",
          hint: "555 pinout: 1=GND, 2=Trigger, 3=Output, 4=Reset, 5=Control, 6=Threshold, 7=Discharge, 8=VCC",
          components: ["555 Timer IC", "Breadboard"],
          completed: false,
          active: true,
        },
        {
          id: 2,
          title: "Connect power pins",
          description: "Connect pin 1 to GND rail. Connect pin 8 to VCC. Connect pin 4 (Reset) to VCC to keep it HIGH (disabled).",
          hint: "Always connect Reset pin to VCC unless you need the reset function — floating Reset can cause erratic behavior.",
          components: ["Jumper wires"],
          completed: false,
          active: false,
        },
        {
          id: 3,
          title: "Add timing components",
          description: "Connect R1 (10kΩ) from VCC to pin 7. Connect R2 (10kΩ) from pin 7 to pin 6/2. Connect capacitor (10μF) from pin 6/2 to GND.",
          hint: "Frequency ≈ 1.44 / ((R1 + 2×R2) × C) = 1.44 / (30kΩ × 10μF) ≈ 4.8 Hz",
          components: ["10kΩ Resistors", "10μF Capacitor"],
          completed: false,
          active: false,
        },
        {
          id: 4,
          title: "Connect the LED",
          description: "Connect 1kΩ resistor from pin 3 (Output) to LED anode. LED cathode to GND.",
          hint: "Pin 3 swings between LOW (~0V) and HIGH (~VCC-1.5V). The 1kΩ current-limits the LED.",
          components: ["LED", "1kΩ Resistor"],
          completed: false,
          active: false,
        },
        {
          id: 5,
          title: "Power on and observe",
          description: "Apply power. The LED should blink approximately every 200ms. Adjust R2 or C to change the blink rate.",
          hint: "To slow it down: increase R2 or use a larger capacitor. To speed it up: decrease both. The 555 is very forgiving — experiment!",
          components: [],
          completed: false,
          active: false,
        },
      ];

    default:
      return getLabSteps("led-circuit");
  }
}
