import java.util.Scanner;

/**
 * A simple console calculator that supports basic arithmetic operations.
 */
public class Calculator {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.println("Simple Java Calculator");
        System.out.println("Supported operators: +, -, *, /");

        while (true) {
            System.out.print("Enter first number (or 'q' to quit): ");
            String firstInput = scanner.nextLine().trim();
            if (firstInput.equalsIgnoreCase("q")) {
                break;
            }

            double firstNumber;
            try {
                firstNumber = Double.parseDouble(firstInput);
            } catch (NumberFormatException exception) {
                System.out.println("Invalid number. Please try again.");
                continue;
            }

            System.out.print("Enter operator (+, -, *, /): ");
            String operator = scanner.nextLine().trim();

            System.out.print("Enter second number: ");
            String secondInput = scanner.nextLine().trim();

            double secondNumber;
            try {
                secondNumber = Double.parseDouble(secondInput);
            } catch (NumberFormatException exception) {
                System.out.println("Invalid number. Please try again.");
                continue;
            }

            try {
                double result = calculate(firstNumber, secondNumber, operator);
                System.out.printf("Result: %.10g%n", result);
            } catch (IllegalArgumentException exception) {
                System.out.println(exception.getMessage());
            }

            System.out.println();
        }

        scanner.close();
        System.out.println("Calculator closed.");
    }

    public static double calculate(double firstNumber, double secondNumber, String operator) {
        switch (operator) {
            case "+":
                return firstNumber + secondNumber;
            case "-":
                return firstNumber - secondNumber;
            case "*":
                return firstNumber * secondNumber;
            case "/":
                if (secondNumber == 0) {
                    throw new IllegalArgumentException("Cannot divide by zero.");
                }
                return firstNumber / secondNumber;
            default:
                throw new IllegalArgumentException("Unsupported operator. Please use +, -, *, or /.");
        }
    }
}
