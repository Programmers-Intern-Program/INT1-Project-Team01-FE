import java.util.Scanner;

public class Multiplication {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);

        System.out.print("첫 번째 숫자를 입력하세요: ");
        double firstNumber = scanner.nextDouble();

        System.out.print("두 번째 숫자를 입력하세요: ");
        double secondNumber = scanner.nextDouble();

        double result = firstNumber * secondNumber;
        System.out.println("곱셈 결과: " + result);

        scanner.close();
    }
}
